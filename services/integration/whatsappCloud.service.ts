import { supabase } from '../supabaseClient';
import { WhatsAppConnection, WhatsAppConnectionType } from '../../types';

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
  }
}

let fbSdkPromise: Promise<void> | null = null;
let isFbInitialized = false;

export const WhatsAppCloudService = {
  /**
   * Busca as conexões ativas para uma dada unidade
   */
  async getConnections(unitId: string): Promise<WhatsAppConnection[]> {
    const { data, error } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('unit_id', unitId);
    
    if (error) {
      console.error('[WhatsAppCloudService] getConnections error:', error);
      throw error;
    }
    return data || [];
  },

  /**
   * Desconecta (deleta) a integração do banco
   */
  async disconnect(connectionId: string): Promise<void> {
    const { error } = await supabase
      .from('whatsapp_connections')
      .delete()
      .eq('id', connectionId);
      
    if (error) {
      console.error('[WhatsAppCloudService] disconnect error:', error);
      throw error;
    }
  },

  /**
   * Inicializa dinamicamente o SDK do Facebook, blindado contra recarregamento 
   * rápido do Vite (HMR) e falhas prematuras.
   */
  initFacebookSdk(): Promise<void> {
    const appId = import.meta.env.VITE_META_APP_ID;
    
    if (!appId) {
      return Promise.reject(new Error("A variável VITE_META_APP_ID está vazia no .env. Configure o App ID do Facebook para prosseguir."));
    }

    if (fbSdkPromise) return fbSdkPromise;

    fbSdkPromise = new Promise((resolve) => {
      // Função que aplica a inicialização da API
      const applyInit = () => {
        try {
          window.FB.init({
            appId            : appId,
            autoLogAppEvents : true,
            xfbml            : true,
            version          : 'v19.0'
          });
        } catch(e) { /* Ignora avisos de already initialized do FB */ }
        isFbInitialized = true;
        resolve();
      };

      // Se ocorreu um HMR, o script e o window.FB já estão na tela,
      // mas `isFbInitialized` zerou. Executamos o init() de forma blindada.
      if (window.FB) {
        applyInit();
        return;
      }
      
      // Associa a callback assíncrona para quando o browser baixar o sdk.js
      window.fbAsyncInit = applyInit;
      
      // Injete  o script se nunca foi injetado (primeiro acesso)
      if (!document.getElementById('facebook-jssdk')) {
        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = "https://connect.facebook.net/pt_BR/sdk.js";
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
      }
    });

    return fbSdkPromise;
  },

  /**
   * Abre o Popup do Facebook SDK (FB.login) 
   * em vez de redirecionar a página inteira.
   */
  async login(): Promise<any> {
    await this.initFacebookSdk();
    
    return new Promise((resolve, reject) => {
      window.FB.login((response: any) => {
        if (response.authResponse) {
           resolve(response.authResponse); // Retorna accessToken, userID, etc.
        } else {
           reject(new Error('Login cancelado ou autorização não finalizada.'));
        }
      }, {
        // Escopos obrigatórios do WhatsApp
        scope: 'whatsapp_business_management,whatsapp_business_messaging',
        return_scopes: true
      });
    });
  },

  /**
   * Envia o Token obtido no Frontend (via SDK JS) para o nosso Backend
   * validar na Meta e gravar as conexões.
   */
  async saveConnection(unitId: string, type: WhatsAppConnectionType, authResponse: any): Promise<void> {
    const { data, error } = await supabase.functions.invoke('meta-save-token', {
      body: {
        unitId,
        type,
        accessToken: authResponse.accessToken,
        userId: authResponse.userID,
        expiresIn: authResponse.expiresIn
      }
    });

    if (error) {
      console.error('[WhatsAppCloudService] Invoke error:', error);
      throw error;
    }
    
    if (data?.error) {
      throw new Error(data.error);
    }
  }
};

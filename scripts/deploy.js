import SftpClient from 'ssh2-sftp-client';
import path from 'path';

/**
 * Script de Deploy SFTP (SSH) para DromeFlow
 * 
 * Utiliza a porta 65002 da Hostinger para transferir arquivos via SSH.
 * Mais seguro e confiável que o FTP tradicional.
 */

const sftp = new SftpClient();

const config = {
    host: process.env.SFTP_HOST || '72.61.220.147',
    port: parseInt(process.env.SFTP_PORT || '65002'),
    username: process.env.SFTP_USER || 'u854441981',
    password: process.env.SFTP_PASSWORD
};

const localDir = path.resolve('./dist');
const remoteDir = `${process.env.SFTP_DEST || 'public_html'}/`;

async function deploy() {
    try {
        if (!config.password) {
            console.error("❌ Erro: SFTP_PASSWORD não definido no .env.local");
            process.exit(1);
        }

        console.log("🚀 Iniciando deploy via SFTP (SSH)...");
        console.log(`🌐 Servidor: ${config.host}:${config.port}`);
        console.log(`👤 Usuário: ${config.username}`);
        console.log(`📂 Destino: ${remoteDir}`);

        await sftp.connect(config);
        console.log("✅ Conectado com sucesso.");

        console.log("📤 Sincronizando arquivos (uploadDir)...");
        
        // uploadDir realiza o upload recursivo de toda a pasta dist
        const result = await sftp.uploadDir(localDir, remoteDir);
        
        console.log(`\n✅ ${result}`);
        console.log("🚀 Deploy finalizado com sucesso!");
        console.log("🔗 Verifique em: https://dromeflow.com");

    } catch (err) {
        console.error("\n❌ Erro durante o deploy SFTP:");
        console.error(err.message);
        
        if (err.message.includes('Authentication failure')) {
            console.log("⚠️ Dica: Verifique se o usuário e senha no .env.local estão corretos para SSH.");
        }
        
        process.exit(1);
    } finally {
        await sftp.end();
    }
}

deploy();

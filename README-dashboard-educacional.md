# Dashboard Educacional DromeFlow

## 📋 Sobre

Este arquivo (`dashboard-educacional.html`) é uma réplica educacional em HTML puro do sistema DromeFlow, criado para fins didáticos e de demonstração.

## 🎯 Objetivos

- Demonstrar visualmente o layout e funcionamento do dashboard
- Servir como material educacional para desenvolvimento web
- Mostrar como construir interfaces sem frameworks JavaScript
- Fornecer referência para usuários finais do sistema

## �� Como Usar

### Método 1: Abrir Diretamente no Navegador

1. Localize o arquivo `dashboard-educacional.html` na raiz do projeto
2. Clique duas vezes no arquivo OU
3. Arraste o arquivo para o navegador

### Método 2: Servidor HTTP Local (Recomendado)

```bash
# Python 3
python3 -m http.server 8080

# Node.js (com http-server)
npx http-server -p 8080

# PHP
php -S localhost:8080
```

Depois acesse: `http://localhost:8080/dashboard-educacional.html`

## ✨ Funcionalidades Interativas

### Desktop
- ✅ **Clique no ícone de menu** na sidebar para colapsar/expandir
- ✅ **Clique nos itens do menu** para navegar entre módulos
- ✅ **Clique nos cards de métricas** para selecioná-los
- ✅ **Selecione diferentes unidades** no dropdown

### Mobile (< 1024px)
- ✅ **Clique no ícone de menu** no topo para abrir a sidebar
- ✅ **Clique fora da sidebar** (no overlay escuro) para fechar
- ✅ **Navegue normalmente** pelos módulos

## 🎨 Tema de Cores

O arquivo utiliza as cores oficiais do DromeFlow:

```css
--accent-primary: #0D8ABC      /* Azul principal */
--brand-dark-blue: #010d32     /* Azul escuro da sidebar */
--brand-cyan: #00d5ff          /* Ciano */
--bg-primary: #f8fafc          /* Fundo claro */
--bg-secondary: #ffffff        /* Branco dos cards */
--text-primary: #1e293b        /* Texto principal */
```

## 📱 Responsividade

O layout se adapta automaticamente:

- **Desktop (≥ 1024px)**: Sidebar fixa, layout em duas colunas
- **Tablet/Mobile (< 1024px)**: Sidebar oculta, header mobile visível

## 🏗️ Estrutura do Código

### HTML
```
dashboard-educacional.html
├── <head>
│   ├── Meta tags (charset, viewport)
│   ├── Title
│   └── <style> (CSS inline completo)
└── <body>
    ├── Sidebar (navegação)
    │   ├── Header (logo + botão colapsar)
    │   ├── Seletor de unidade
    │   ├── Menu de navegação
    │   └── Perfil do usuário
    ├── Main Content
    │   ├── Header mobile
    │   └── Content Area (páginas)
    ├── Mobile Overlay
    └── <script> (JavaScript inline)
```

### JavaScript

O arquivo contém funções para:

1. **Toggle de Sidebar** - Colapsar/expandir no desktop
2. **Menu Mobile** - Abrir/fechar sidebar em mobile
3. **Navegação** - Trocar entre diferentes módulos
4. **Cards Interativos** - Estado ativo/inativo
5. **Responsividade** - Ajustes dinâmicos de layout

## 📚 Seções Educacionais

O código inclui comentários extensivos em português explicando:

- **Variáveis CSS**: Sistema de cores e tokens de design
- **Layout Flexbox**: Como funciona a estrutura de duas colunas
- **Transições CSS**: Animações suaves de sidebar
- **Media Queries**: Breakpoints e responsividade
- **Event Listeners**: Interatividade com JavaScript vanilla
- **DOM Manipulation**: Troca de classes e visibilidade

## 🧪 Páginas/Módulos Disponíveis

O arquivo simula 7 módulos diferentes:

1. **Dashboard** - Cards de métricas e gráficos
2. **Agendamentos** - Calendário de serviços
3. **Clientes** - Base de clientes
4. **Profissionais** - Equipe cadastrada
5. **Comercial** - Pipeline de vendas
6. **Dados** - Importação de dados
7. **Configurações** - Preferências do sistema

## 🔧 Personalização

Para customizar o dashboard:

### Alterar Cores

Edite as variáveis CSS no `:root`:

```css
:root {
    --accent-primary: #SuaCor;
    --brand-dark-blue: #SuaCor;
    /* ... outras cores */
}
```

### Adicionar Módulos

1. Adicione um novo item na `nav-menu`
2. Crie uma nova `div` com ID único (ex: `meuModuloView`)
3. Adicione lógica no JavaScript em `views`

### Modificar Métricas

Edite o HTML dos cards em `.metrics-grid`:

```html
<div class="metric-card">
    <!-- Seu conteúdo aqui -->
</div>
```

## 📖 Aprendizados

Este arquivo demonstra:

- ✅ HTML semântico e acessível
- ✅ CSS moderno (Flexbox, variáveis, transições)
- ✅ JavaScript vanilla (sem dependências)
- ✅ Design responsivo (mobile-first)
- ✅ Padrões de UI/UX (sidebar, cards, navegação)
- ✅ Boas práticas (comentários, organização)

## 🤝 Contribuindo

Para melhorias neste arquivo educacional:

1. Mantenha os comentários em português
2. Documente novas funcionalidades
3. Teste em diferentes navegadores
4. Valide acessibilidade (ARIA labels)
5. Mantenha compatibilidade mobile

## 📝 Notas Técnicas

- **Tamanho**: ~47KB (sem compressão)
- **Linhas**: 1,214
- **Dependências**: Nenhuma
- **Navegadores**: Chrome, Firefox, Safari, Edge (versões recentes)
- **JavaScript**: ES6+ (arrow functions, const/let, template literals)

## 🎓 Casos de Uso

Este arquivo pode ser usado para:

1. **Treinamento** de novos desenvolvedores
2. **Apresentações** para stakeholders
3. **Mockups** de novas funcionalidades
4. **Estudos** de HTML/CSS/JS
5. **Templates** para projetos similares

## 📞 Suporte

Para dúvidas sobre o sistema DromeFlow real, consulte a documentação principal do projeto.

---

**Criado com fins educacionais** | DromeFlow © 2024

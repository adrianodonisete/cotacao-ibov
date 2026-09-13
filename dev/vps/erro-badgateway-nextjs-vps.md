# Resumo da Configuração: VPS Linux (InterServer) + CloudPanel 2 + Next.js

Este documento reúne todo o passo a passo efetuado para provisionar, configurar e publicar um projeto Next.js em um VPS de 1 Slice (2 GB RAM) na InterServer utilizando o painel de gerenciamento CloudPanel 2 e automação de deploy via GitHub Actions.

---

## 1. Provisionamento e Escolha do Sistema

- **Provedor:** InterServer (Instância KVM, 1 Slice / 2 GB RAM).
- **Sistema Operacional:** Ubuntu 26.04 LTS (Versão de Longo Termo, com suporte até 2031).
- **Painel Escolhido:** **CloudPanel 2** (Melhor opção para o cenário devido ao consumo ultraleve de RAM, cerca de 100-150MB, ideal para servidores de 2GB).

---

## 2. Otimização Obrigatória do Servidor (Via SSH)

Para evitar que o Next.js ou o banco de dados MariaDB travem o servidor por falta de memória, foi configurado um arquivo de memória Swap de 2GB:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 3. Estrutura do Site no CloudPanel

No painel do CloudPanel, o site foi criado com as seguintes especificações:

- **Tipo:** Node.js Site
- **Domínio:** `my.wallet.local` (mapeado via arquivo `hosts` do Windows para o IP do VPS).
- **Porta da Aplicação (App Port):** `3000` (Porta padrão onde o Next.js roda internamente).

---

## 4. Integração Contínua (CI/CD) com GitHub Actions

Para não estressar a CPU e a memória do VPS compilando o Next.js (`npm run build`) dentro dele, configuramos a automação para compilar nos servidores do GitHub e transferir os arquivos prontos via **SSH/SFTP**.

### Configuração no GitHub (Repository Secrets):

- `SSH_HOST`: O IP do seu VPS.
- `SSH_USER`: O usuário SSH criado dentro do site no CloudPanel.
- `SSH_KEY`: A chave privada RSA gerada no seu computador (com a correspondente chave pública adicionada ao usuário no CloudPanel).

### Arquivo do Workflow (`.github/workflows/deploy.yml`):

```yaml
name: Deploy Next.js to InterServer

on:
  push:
    branches:
      - master # Ajustado para ler a sua ramificação padrão

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Build Project
        run: npm run build

      - name: Deploy to VPS via SFTP (SSH)
        uses: easingthemes/ssh-deploy@v5.1.0
        with:
          SSH_PRIVATE_KEY: \${{ secrets.SSH_KEY }}
          ARGS: '-rlgoDzvc --delete'
          REMOTE_HOST: \${{ secrets.SSH_HOST }}
          REMOTE_USER: \${{ secrets.SSH_USER }}
          TARGET: /home/my-wallet/htdocs/my.wallet.local/
          SOURCE: ./
          EXCLUDE: 'node_modules,src,app,pages,components,.git,.github'
```

---

## 5. Arquivo de configuração do vhost no VPS

O arquivo com as configurações de vhost do site "my.wallet.local" estão em:
/dev/vps/vhost-file-content.txt

---

## 6. Ajuste do Erro 502 Bad Gateway (Configuração do Vhost)

O erro 502 final ocorre porque o domínio é local (`.local`) e não possui certificado SSL real na porta 443, associado a um pequeno detalhe técnico no proxy do Nginx.

### Correções no arquivo Vhost (dentro do CloudPanel):

1. **Remover o redirecionamento para HTTPS:** Apagar ou comentar o bloco que força o `https://$host...` para evitar loops de segurança com o domínio local.
2. **Ajustar a barra final do `proxy_pass`:** Mudar a linha do proxy para terminar sem a barra no final do número da porta, garantindo que as rotas internas funcionem perfeitamente.

De:

```nginx
proxy_pass http://127.0.0.1:{{app_port}}/;
```

Para:

```nginx
proxy_pass http://127.0.0.1:{{app_port}};
```

### Tentar acessar apenas com http:

Acesse o site usando estritamente o protocolo HTTP em uma **Aba Anônima** do navegador para ignorar os caches antigos:
👉 `http://my.wallet.local/`

Quando acesso usando apenas http, a config do vhost (citado no item 5) força o redirecionamento para https.

# 🚀 Deploy no Azure App Service - Guia Completo

Este guia mostra como configurar deploy automático da aplicação Python no Azure App Service.

## 📋 Pré-requisitos

- Conta no Azure (gratuita funciona)
- Repositório no GitHub
- Aplicação Python com Flask configurada

## 🔧 Passo 1: Criar o Azure App Service

### 1.1 Acessar o Portal Azure
1. Acesse [portal.azure.com](https://portal.azure.com)
2. Faça login com sua conta Microsoft/Azure

### 1.2 Criar Web App
1. Clique em **"Create a resource"** (+ Criar recurso)
2. Procure por **"Web App"**
3. Clique em **"Create"**

### 1.3 Configurar Básico
**Subscription**: Sua assinatura Azure
**Resource Group**: Crie um novo ou use existente
**Name**: `simulado-az204` (escolha um nome único)
**Publish**: **Code**
**Runtime stack**: **Python 3.13**
**Operating System**: **Linux**
**Region**: **East US** (ou mais próxima)

### 1.4 Configurar Pricing
**Pricing plan**: **Free F1** (para teste) ou **Basic B1** (para produção)

### 1.5 Finalizar
1. Clique em **"Review + create"**
2. Clique em **"Create"**
3. Aguarde o deployment (2-3 minutos)

**✅ Resultado**: Sua URL será `https://simulado-az204.azurewebsites.net`

## 🔐 Passo 2: Configurar Secrets no GitHub

### 2.1 Baixar Publish Profile
1. No App Service criado, clique em **"Get publish profile"**
2. Baixe o arquivo `.publishsettings`
3. Abra o arquivo e **copie todo o conteúdo XML**

### 2.2 Configurar no GitHub
1. Vá para seu repositório no GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. Clique em **"New repository secret"**

**Secret 1:**
- Name: `AZURE_APP_NAME`
- Value: `simulado-az204` (seu nome do App Service)

**Secret 2:**
- Name: `AZURE_PUBLISH_PROFILE`
- Value: Cole o conteúdo completo do arquivo .publishsettings

## 🤖 Passo 3: GitHub Actions (Já Configurado)

### 3.1 Workflow Incluído
O arquivo `.github/workflows/deploy.yml` **já está incluído** no projeto com a seguinte configuração:

- ✅ **Trigger**: Push na branch `main` ou execução manual
- ✅ **Python 3.13**: Configurado automaticamente
- ✅ **Dependências**: Instalação automática via `requirements.txt`
- ✅ **Deploy**: Automático para Azure App Service

### 3.2 Como Funciona
1. **Push na main** → Deploy automático
2. **Pull Request** → Apenas validação (sem deploy)
3. **Execução manual** → Via GitHub Actions tab

**📁 Localização**: `.github/workflows/deploy.yml`

## ⚙️ Passo 4: Configurar App Service

### 4.1 Startup Command
1. No App Service, vá em **Configuration** → **General settings**
2. **Startup Command**: `gunicorn --bind=0.0.0.0 --workers=4 app:app`
3. Clique em **"Save"**

### 4.2 Configurações Adicionais (Opcional)
- **Always On**: Ativado (evita cold start)
- **ARR Affinity**: Desativado (melhor performance)
- **HTTPS Only**: Ativado (segurança)

## 🛡️ Passo 5: Proteger Branch Main

### 5.1 Configurar Branch Protection
1. GitHub → **Settings** → **Branches**
2. **Add branch protection rule**
3. **Branch name pattern**: `main`

### 5.2 Regras Recomendadas
- ✅ **Require a pull request before merging**
- ✅ **Require approvals**: 1
- ✅ **Dismiss stale reviews when new commits are pushed**
- ✅ **Require status checks to pass before merging**
- ✅ **Require branches to be up to date before merging**
- ✅ **Restrict pushes that create files**

## 🧪 Passo 6: Testar o Deploy

### 6.1 Primeiro Deploy
1. Faça um commit na branch `main`
2. Push para o GitHub
3. Vá em **Actions** no GitHub para acompanhar
4. Acesse sua URL após deploy completo

### 6.2 Teste com Pull Request
1. Crie uma branch de teste:
   ```bash
   git checkout -b teste-deploy
   ```
2. Faça uma alteração no código
3. Commit e push da branch
4. Abra Pull Request no GitHub
5. Solicite aprovação
6. Após aprovação, faça merge
7. Deploy automático será executado

## 🔍 Troubleshooting

### Erro: "Application startup failed"
**Solução**: Verificar se o Startup Command está correto:
`gunicorn --bind=0.0.0.0 --workers=4 app:app`

### Erro: "Module not found"
**Solução**: Verificar se `requirements.txt` está correto e no root do projeto

### Deploy não executa
**Solução**: 
1. Verificar se os secrets estão configurados
2. Verificar se o workflow está na branch `main`
3. Verificar logs em GitHub Actions

### Aplicação não carrega CSS/JS
**Solução**: Verificar se os arquivos estão na pasta `assets/` e se o Flask está servindo corretamente

## 💰 Custos Estimados

### Free Tier (F1)
- **Custo**: Gratuito
- **Limitações**: 60 min/dia, 1GB storage
- **Ideal para**: Testes e desenvolvimento

### Basic Tier (B1)
- **Custo**: ~R$ 50/mês
- **Recursos**: 1.75GB RAM, 10GB storage
- **Ideal para**: Produção pequena

### Standard Tier (S1)
- **Custo**: ~R$ 150/mês
- **Recursos**: 1.75GB RAM, 50GB storage, SSL customizado
- **Ideal para**: Produção média

## 📊 Monitoramento

### Logs da Aplicação
1. App Service → **Log stream**
2. Visualizar logs em tempo real

### Métricas
1. App Service → **Metrics**
2. Monitorar CPU, memória, requests

### Alertas
1. App Service → **Alerts**
2. Configurar alertas para problemas

## 🎯 Checklist Final

- [ ] App Service criado com Python 3.13
- [ ] Secrets configurados no GitHub
- [ ] Workflow do GitHub Actions funcionando
- [ ] Startup Command configurado
- [ ] Branch protection ativada
- [ ] Primeiro deploy realizado com sucesso
- [ ] Aplicação acessível via URL
- [ ] CSS/JS carregando corretamente

## 🔗 Links Úteis

- [Azure App Service Docs](https://docs.microsoft.com/azure/app-service/)
- [GitHub Actions Docs](https://docs.github.com/actions)
- [Flask Deployment Guide](https://flask.palletsprojects.com/en/2.3.x/deploying/)

---

🎉 **Parabéns!** Sua aplicação está rodando no Azure com deploy automático configurado! 
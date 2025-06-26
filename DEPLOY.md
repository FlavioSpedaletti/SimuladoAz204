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

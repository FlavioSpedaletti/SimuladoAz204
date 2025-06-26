# Simulado AZ-204

Sistema de simulado para certificação Microsoft Azure Developer Associate (AZ-204).

## Estrutura do Projeto

```
SimuladoAz204/
├── .github/workflows/        # GitHub Actions
│   └── deploy.yml           # Deploy automático para Azure
├── assets/                   # Arquivos CSS e JavaScript separados
│   ├── style.css            # Estilos da aplicação
│   └── script.js            # Lógica JavaScript
├── data/                    # Dados das questões
│   └── data.json            # Base de questões do simulado
├── index.html               # Página principal com cache busting automático
├── app.py                   # Servidor Flask para produção
├── requirements.txt         # Dependências Python
├── DEPLOY.md                # Guia de deploy no Azure
└── README.md                # Este arquivo
```

## Como Usar

### Desenvolvimento Local (Simples)

Para desenvolvimento rápido:

1. Clone o repositório
2. Abra o arquivo `index.html` diretamente no navegador
   - **OU** inicie um servidor HTTP local:
   ```bash
   # Python
   python -m http.server 8000
   
   # Node.js
   npx live-server
   
   # PHP
   php -S localhost:8000
   ```
3. **Pronto!** O cache busting funciona automaticamente

### Teste Local como Produção (Flask)

Para testar exatamente como ficará no Azure:

1. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```

2. Execute a aplicação Flask:
   ```bash
   python app.py
   ```

3. Acesse: `http://localhost:8000`

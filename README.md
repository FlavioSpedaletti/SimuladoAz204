# 🎯 Simulado AZ-204

Sistema de simulado para certificação Microsoft Azure Developer Associate (AZ-204).

## 🚀 Como Usar

### 💻 Desenvolvimento Local (Simples)

Para desenvolvimento rápido:

1. 📁 Clone o repositório
2. 🌐 Abra o arquivo `index.html` diretamente no navegador
   - **OU** inicie um servidor HTTP local:
   ```bash
   # Python
   python -m http.server 8000
   
   # Node.js
   npx live-server
   
   # PHP
   php -S localhost:8000
   ```
3. **✅ Pronto!** O cache busting funciona automaticamente

### 🏭 Teste Local como Produção (Flask)

Para testar exatamente como ficará no Azure:

1. 📦 Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```

2. ⚡ Execute a aplicação Flask:
   ```bash
   python app.py
   ```

3. 🌐 Acesse: `http://localhost:8000`

## ➕ Como Adicionar Questões

O simulado utiliza o arquivo `data/data.json` para armazenar todas as questões organizadas por módulos. Siga as instruções abaixo para adicionar novas questões:

### 📋 Estrutura do Arquivo JSON

```json
{
  "modulos": {
    "modulo1": {
      "nome": "☁️ Nome do Módulo",
      "descricao": "Descrição do módulo",
      "perguntas": {
        "pergunta1": {
          "descricao": "Texto da pergunta",
          "alternativas": {
            "alternativa1": {"descricao": "Opção A"},
            "alternativa2": {"descricao": "Opção B"}, 
            "alternativa3": {"descricao": "Opção C"},
            "alternativa4": {"descricao": "Opção D"}
          },
          "correta": "alternativa3",
          "explicacao": "Explicação detalhada da resposta correta"
        }
      }
    }
  }
}
```

### ✏️ Adicionando Questões a um Módulo Existente

1. 📂 Abra o arquivo `data/data.json`
2. 🔍 Localize o módulo desejado (ex: `modulo1`, `modulo2`, etc.)
3. 📝 Dentro da seção `"perguntas"`, adicione uma nova entrada:

```json
"perguntaN": {
  "descricao": "Sua pergunta aqui",
  "alternativas": {
    "alternativa1": {"descricao": "Primeira opção"},
    "alternativa2": {"descricao": "Segunda opção"},
    "alternativa3": {"descricao": "Terceira opção"},
    "alternativa4": {"descricao": "Quarta opção"}
  },
  "correta": "alternativa2",
  "explicacao": "Explicação detalhada da resposta correta"
}
```

**⚠️ Importante**: Substitua `N` pelo próximo número sequencial de pergunta no módulo.

### 🆕 Criando um Novo Módulo

1. 📂 Abra o arquivo `data/data.json`
2. ➕ Dentro da seção `"modulos"`, adicione:

```json
"moduloN": {
  "nome": "🔧 Nome do Novo Módulo",
  "descricao": "Descrição do novo módulo",
  "perguntas": {
    "pergunta1": {
      "descricao": "Primeira pergunta do módulo",
      "alternativas": {
        "alternativa1": {"descricao": "Opção A"},
        "alternativa2": {"descricao": "Opção B"},
        "alternativa3": {"descricao": "Opção C"},
        "alternativa4": {"descricao": "Opção D"}
      },
      "correta": "alternativa1",
      "explicacao": "Explicação da resposta"
    }
  }
}
```

### 📏 Regras e Boas Práticas

1. **🆔 IDs únicos**: Cada módulo deve ter um ID único (`modulo1`, `modulo2`, etc.)
2. **🔢 Perguntas sequenciais**: Numere as perguntas sequencialmente dentro de cada módulo
3. **4️⃣ Sempre 4 alternativas**: Cada pergunta deve ter exatamente 4 alternativas
4. **✅ Resposta correta**: O campo `"correta"` deve corresponder a uma das alternativas
5. **📝 Explicação obrigatória**: Sempre inclua uma explicação clara da resposta
6. **😀 Emoji nos módulos**: Use emojis para deixar os módulos mais visuais
7. **🔍 JSON válido**: Verifique se o JSON continua válido após suas alterações

### 🧪 Testando as Alterações

1. 💾 Salve o arquivo `data/data.json`
2. 🔄 Atualize o navegador ou reinicie o servidor local
3. 🎯 Navegue até o módulo modificado para testar as novas questões
4. ✅ Verifique se as respostas corretas e explicações estão funcionando

### 💎 Dicas para Questões de Qualidade

- **🎯 Seja específico**: Evite perguntas ambíguas
- **🌐 Use cenários reais**: Base as questões em situações práticas do Azure
- **📚 Explicações detalhadas**: Inclua o "porquê" da resposta na explicação
- **🎭 Alternativas plausíveis**: Torne as opções incorretas believáveis
- **🎓 Foque no AZ-204**: Mantenha o conteúdo relevante para a certificação

### 🤖 Exemplos de Prompts para ChatGPT

Para facilitar a criação de conteúdo para o simulado, aqui estão exemplos de prompts que você pode usar com o ChatGPT:

#### 📝 Prompt para Gerar Simulados

```
Faça um simulado com 60 questões para a prova AZ-204 apenas com questões sobre azure app service, com alternativas bem parecidas com as da prova
```

#### 🔧 Prompt para Gerar Gabarito no Formato JSON

```
Gere um gabarito final, com todas as 60 questões, seguindo o formato do json abaixo
divida em partes de 20 em 20 questões para não ultrapassar o limite de resposta e para facilitar a cópia e entendimento.

{
   "modulo1": {
      "nome": "texto",
      "descricao": "texto",
      "perguntas": {
         "pergunta1": {
            "descricao": "texto",
            "alternativas": {
               "alternativa1": {
                  "descricao": "texto"
               },
               "alternativa2": {
                  "descricao": "texto"
               }
            },
           "correta": "alternativa1",
           "explicacao": "texto"
         }
      }
   }
}
```

#### 💡 Dicas para Usar os Prompts

- **🎯 Seja específico no tópico**: Substitua "azure app service" pelo tópico desejado
- **🔢 Ajuste a quantidade**: Modifique o número de questões conforme necessário
- **📊 Peça divisão em partes**: Para questões longas, sempre peça para dividir em blocos menores
- **📝 Solicite explicações**: Sempre inclua pedidos para explicações detalhadas das respostas
- **✅ Revise o JSON**: Sempre valide o JSON gerado antes de adicionar ao arquivo `data.json`

# DeepWiki Scraper

Um utilitário de linha de comando para extrair conteúdo de projetos DeepWiki e exportá-los como arquivos JSON e Markdown.

## 📑 Descrição

DeepWiki Scraper é uma ferramenta Node.js/TypeScript que automatiza a extração de documentação de wikis hospedadas na plataforma DeepWiki. A ferramenta navega por cada página de um ou mais projetos especificados, extrai o conteúdo e compila um documento único em formato JSON e Markdown para referência offline ou integração com outras ferramentas.

## ✨ Recursos

- **Múltiplos Projetos**: Extrai conteúdo de vários projetos DeepWiki em uma única execução
- **Entrada Interativa**: Interface de linha de comando para inserir URLs separadas por vírgula
- **Navegação Automática**: Extrai todas as páginas automaticamente a partir do menu de navegação
- **Exportação Flexível**: Salva o conteúdo em formato JSON para processamento e Markdown para leitura
- **Nomeação Inteligente**: Os arquivos são nomeados automaticamente com base no nome do projeto
- **Tratamento de Erros**: Lida graciosamente com timeouts e erros de carregamento de página

## 🔧 Pré-requisitos

- Node.js (versão 14 ou superior)
- npm ou yarn

## 🚀 Instalação

1. Clone este repositório:
   ```bash
   git clone https://github.com/SEU_USUARIO/deepwiki-scraper.git
   cd deepwiki-scraper
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

## 💻 Como Usar

### Executando a Ferramenta

```bash
npm start
```

### Fornecendo URLs

Quando solicitado, insira uma ou mais URLs de projetos DeepWiki separadas por vírgula:

```
Digite as URLs dos projetos separadas por vírgula:
https://deepwiki.com/Usuario/projeto1, https://deepwiki.com/Usuario/projeto2
```

### Formato das URLs

Cada URL deve apontar para a página principal de um projeto DeepWiki:

```
https://deepwiki.com/Usuario/nome-do-projeto
```

### Arquivos de Saída

Para cada projeto, dois arquivos serão gerados:

- `nome-do-projeto.deepwiki.json`: Conteúdo em formato JSON para processamento programático
- `nome-do-projeto.deepwiki.md`: Conteúdo em formato Markdown para leitura humana

## 🛠️ Tecnologias Utilizadas

- **TypeScript**: Tipagem estática para melhor qualidade de código
- **Playwright**: Automação de navegador para extração de conteúdo
- **Node.js**: Ambiente de execução

## 📋 Estrutura do Projeto

```
deepwiki-scraper/
├── scrape-all.ts       # Script principal
├── package.json        # Dependências e scripts
├── tsconfig.json       # Configuração do TypeScript
└── README.md           # Documentação
```

## 📊 Formato de Saída

### JSON

O arquivo JSON segue esta estrutura:

```json
{
  "Título da Página 1": "Conteúdo da Página 1",
  "Título da Página 2": "Conteúdo da Página 2",
  ...
}
```

### Markdown

O arquivo Markdown segue esta estrutura:

```markdown
## Título da Página 1

Conteúdo da Página 1

---

## Título da Página 2

Conteúdo da Página 2

---
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:

1. Abrir issues para relatar bugs ou solicitar recursos
2. Enviar pull requests com melhorias
3. Melhorar a documentação

## 📜 Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para mais detalhes.

## ⚠️ Aviso Legal

Esta ferramenta foi criada para facilitar o acesso legítimo a conteúdo DeepWiki para fins de backup pessoal ou uso offline. Respeite os termos de serviço da plataforma DeepWiki e os direitos autorais de conteúdo de terceiros.

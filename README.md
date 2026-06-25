# Minhas Finanças (PWA)

App PWA para lançar entradas e despesas, com **Google Sheets como base de dados**.

## Funcionalidades

- Login com Google
- Lê **sua planilha atual** (categoria, valor, pago, observação)
- Dashboard: saldo, total gastos, pagos e a pagar
- Lista com checkbox de "pago" (como sua planilha)
- Filtros: todos, a pagar, pagos
- Formulário rápido com sugestão de categorias
- Instalável no iPhone, iPad e Mac (Safari → Compartilhar → Adicionar à Tela de Início)

## Estrutura da planilha

O app lê a aba que você escolher, no formato:

| A (categoria) | B (valor) | C (pago) | D (observação) |
|---------------|-----------|----------|----------------|
| Salário | 9572,50 | TRUE | |
| Internet | 123,08 | TRUE | |
| Cartão Baby | 1676,39 | FALSE | |

- Linhas com **Salário** são tratadas como entrada
- Linhas de totais (Total gastos, Saldo…) são ignoradas automaticamente

## Configuração do Google Cloud (uma vez)

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie um projeto (ex: `minhas-financas`)
3. Ative a **Google Sheets API**
4. Vá em **APIs e serviços → Tela de consentimento OAuth**
   - Tipo: Externo (ou Interno se for Workspace)
   - Adicione seu e-mail como usuário de teste
5. Vá em **Credenciais → Criar credenciais → ID do cliente OAuth**
   - Tipo: **Aplicativo da Web**
   - Origens JavaScript autorizadas:
     - `http://localhost:5173`
     - URL de produção (ex: `https://seu-app.vercel.app`)
6. Copie o **Client ID**

## Rodar localmente

```bash
cp .env.example .env
# Edite .env com VITE_GOOGLE_CLIENT_ID e (opcional) VITE_SPREADSHEET_ID

npm install
npm run dev
```

Abra `http://localhost:5173`, faça login e cole o link da sua planilha.

## Deploy (Vercel)

1. Suba o projeto no GitHub
2. Importe no [Vercel](https://vercel.com)
3. Adicione a variável `VITE_GOOGLE_CLIENT_ID`
4. Adicione a URL do Vercel nas origens autorizadas do OAuth no Google Cloud

## Scripts

- `npm run dev` — desenvolvimento
- `npm run build` — build de produção
- `npm run preview` — preview do build

## Próximos passos possíveis

- Importar dados da sua planilha atual
- Modo offline com fila de sincronização
- Gráficos por categoria

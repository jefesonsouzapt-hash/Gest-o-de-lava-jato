# CRM e Gestão para Lava Jato / Estética Automotiva

Sistema de gestão operacional e financeira para lava jatos e centros de detalhe
automotiva no **Brasil**: recepção de veículos, fila de espera e agendamentos,
pistas, ordens de serviço, estoque, fidelidade, comissões e folha de pagamento.

Next.js (App Router) · TypeScript · PostgreSQL com Drizzle · Zod · Vitest ·
Playwright · Tailwind CSS.

> As regras de código, o vocabulário obrigatório de pt-BR e o fluxo de trabalho
> do GitHub estão em **[AGENTS.md](./AGENTS.md)**. Leia antes de contribuir.

## Localização

| | |
| --- | --- |
| Idioma | Português do Brasil (pt-BR) |
| Moeda | Real (R$), gravado em centavos inteiros |
| Fuso | America/Sao_Paulo |
| Identificadores | CPF/CNPJ, CEP `00000-000`, Placa `ABC-1234` e `ABC1D23` |
| Pagamentos | PIX, Dinheiro, Débito, Crédito, Transferência, Boleto |
| Imposto | ISS municipal (2% a 5%) |

## Como correr

Requisitos: Node 20+, pnpm e um PostgreSQL.

```bash
pnpm install
cp .env.example .env.local   # preencher DATABASE_URL
pnpm db:push
pnpm dev
```

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm typecheck` | Verificação de tipos |
| `pnpm test` | Testes unitários (Vitest) |
| `pnpm test:e2e` | Testes ponta a ponta (Playwright) |
| `pnpm build` | Build de produção |

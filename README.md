# CRM e Gestão para Lava Jato / Centro de Detalhe

Sistema de gestão operacional e financeira para lava jatos e centros de detalhe
automóvel em **Portugal**: receção de viaturas, fila de espera e agendamentos,
pistas de lavagem, fichas de trabalho, consumíveis, fidelização e faturação.

Next.js (App Router) · TypeScript · PostgreSQL com Drizzle · Zod · Vitest ·
Playwright · Tailwind CSS.

> As regras de código, o vocabulário obrigatório de pt-PT e o fluxo de trabalho
> do GitHub estão em **[AGENTS.md](./AGENTS.md)**. Leia antes de contribuir.

## Localização

| | |
| --- | --- |
| Idioma | Português de Portugal (pt-PT) |
| Moeda | Euro (€), guardada em cêntimos inteiros |
| Fuso | Europe/Lisbon |
| Identificadores | NIF, Código Postal `0000-000`, Matrícula `AA-00-AA` |
| Pagamentos | MB WAY, Multibanco, Transferência, Dinheiro, Cartão |

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

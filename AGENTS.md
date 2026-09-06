# AGENTS.md — CRM e Gestão para Lava Jato / Estética Automotiva

Diretrizes obrigatórias para qualquer agente ou pessoa que escreva código neste
repositório. O que está aqui vence preferência pessoal e hábito trazido de
outro projeto.

---

## 1. Localização — Brasil (pt-BR)

Toda a aplicação, sem exceção, usa **português do Brasil**.

| Configuração | Valor |
| --- | --- |
| `locale` | `pt-BR` |
| `country` | `BR` |
| `currency` | `BRL` (R$) |
| `timezone` | `America/Sao_Paulo` |

### Vocabulário obrigatório

Use sempre a coluna da esquerda. A da direita é vocabulário de Portugal, que
entrou no projeto numa versão anterior e **não passa em revisão**.

| Usar | Nunca usar |
| --- | --- |
| Celular | Telemóvel |
| Senha | Palavra-passe |
| Usuário | Utilizador |
| Arquivo | Ficheiro |
| Endereço | Morada |
| CEP | Código Postal |
| CPF / CNPJ | NIF |
| Veículo / carro | Viatura |
| Placa | Matrícula |
| Tela | Ecrã |
| Registro | Registo |
| Nota fiscal | Talão / Fatura |
| Contato | Contacto |
| Recepção | Receção |
| Gerenciar / Gestão | Gerir |
| Excluir | Eliminar |
| Salvar | Guardar |
| Estoque | Stock |
| Equipe | Equipa |
| Perfil de acesso | Papel |

### Termos do negócio

Lava Jato, Estética Automotiva, Lavador, Detailer, Polidor, Pista, Box,
Ordem de Serviço (O.S.), Pacote, Combo, Higienização, Polimento,
Vitrificação, Bancos, Rodas, Chassi, Motor.

### Pagamentos

PIX, Dinheiro, Cartão de Débito, Cartão de Crédito, Transferência, Boleto.
**Nunca** MB WAY, Multibanco nem Referência Multibanco.

### Impostos

**ISS** municipal, entre 2 % e 5 % por limite constitucional. Não existe IVA.

---

## 2. Formatação de dados

Tudo passa por `lib/locale/`. **Nunca** formatar na mão numa página ou
componente.

- **Moeda:** `formatCurrency(cents)` → `R$ 15,00`. Valores monetários são
  gravados em **centavos (inteiro)**, nunca em ponto flutuante.
- **Percentuais:** gravados em **pontos-base** (1250 = 12,50 %), para não
  perder meio ponto de comissão no arredondamento.
- **Datas:** `DD/MM/AAAA`. **Horas:** `HH:mm` (24h), sempre
  `America/Sao_Paulo`.
- **Telefone:** entrada livre, normalização interna para `+55DDNNNNNNNNN`.
  Exibição `(11) 98888-7777`. O DDD é conferido contra a lista real.
- **CPF:** 11 dígitos com os dois verificadores; sequências repetidas são
  recusadas. **CNPJ:** 14 dígitos com os dois verificadores.
- **CEP:** `00000-000`. **UF:** conferida contra as 27 siglas.
- **Placa:** `ABC-1234` (antiga) e `ABC1D23` (Mercosul). Gravada sem hífen e
  em maiúsculas; exibida com hífen.
- **Chave PIX:** o tipo é descoberto pelo conteúdo (CPF, CNPJ, e-mail,
  telefone, aleatória) e a chave é recusada quando não é reconhecível.

## 3. Regras de código

- **TypeScript estrito.** Sem `any`, sem `@ts-ignore`, sem
  `typescript.ignoreBuildErrors` no `next.config`.
- **Validação com Zod** em toda a fronteira de entrada: server actions, rotas de
  API e parâmetros de URL. O tipo vem do schema (`z.infer`), não o contrário.
- **Validar sem cortar em silêncio.** 150 % de comissão é recusado com
  mensagem, não virado em 100 % sem o usuário saber.
- **Autorização no servidor.** Esconder um botão não é segurança: cada server
  action e cada página protegida verifica a permissão outra vez.
- **Toda função exportada de um arquivo `"use server"` é um endpoint público.**
  O navegador chama com os argumentos que quiser. Por isso: começa por
  `tryPermission`/`requirePermission`, e **nunca recebe `companyId` por
  parâmetro** — a empresa vem sempre do usuário autenticado. Função auxiliar
  que não é action mora fora desses arquivos.
  `tests/unit/server-actions.test.ts` cobra as duas regras.
- **Erro do banco não vira mensagem adivinhada.** `catch` que assume violação
  de unicidade usa `isUniqueViolation`; o resto sobe.
- **Dinheiro em centavos.** `integer`, nunca `float`. Comissão, desconto e
  imposto arredondam uma única vez, no fim.
- **Folha nunca fica negativa.** Vale que não cabe no líquido do mês rola para
  a folha seguinte; nunca vira salário negativo.
- **Nada de segredos no repositório.** Só `.env.example` com chaves vazias.
- **Comentários explicam o porquê**, não o quê. Em português do Brasil.
- **Sem dados inventados na interface.** Um valor que não existe mostra estado
  vazio, não um número de exemplo.

## 4. Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · Shadcn UI ·
Lucide · Motion (respeitando `prefers-reduced-motion`) ·
PostgreSQL + Drizzle ORM · Zod · Vitest · Playwright.

## 5. Testes

- **Vitest** para regra de negócio: comissão, vale, fechamento de folha, ISS,
  desconto, fidelidade e os validadores de CPF/CNPJ/placa/telefone/PIX.
- **Playwright** para o fluxo completo: chegada do veículo → vistoria →
  lavagem → entrega → pagamento → comissão → folha.
- Um bug corrigido leva sempre um teste que falha antes da correção.
- `pnpm test` precisa passar antes de qualquer push.

## 6. Acessibilidade e desempenho

- WCAG AA: contraste, foco visível, navegação por teclado, `aria-label` em
  botões só de ícone.
- Estados de carregamento explícitos: skeleton, vazio e erro — nunca uma tela
  em branco.
- Animações respeitam `prefers-reduced-motion`.

---

## 7. Fluxo de trabalho GitHub

1. **Nunca** fazer commit direto na `main`.
2. Cada etapa começa por uma **Issue** descritiva.
3. Trabalho em branch nomeada: `feature/001-fundacao`,
   `fix/002-validacao-cpf`.
4. **Pull Request** ligado à Issue: `Closes #001`.
5. O PR só entra com **lint, typecheck, testes e build** verdes.

### Formato do commit

```
tipo(âmbito): resumo no imperativo

Corpo explicando o porquê da alteração.

Closes #NN
```

Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`.

## 8. CI/CD

GitHub Actions em cada PR: `lint` → `typecheck` → `test` → `build`.
Deploy de produção na Vercel a partir da `main`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

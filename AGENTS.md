# AGENTS.md — CRM e Gestão para Lava Jato / Centro de Detalhe

Diretrizes obrigatórias para qualquer agente ou pessoa que escreva código neste
repositório. O que está aqui vence preferências pessoais e hábitos trazidos de
outros projetos.

---

## 1. Localização — Portugal (pt-PT)

Toda a aplicação, sem exceção, usa **Português de Portugal**. Não é português do
Brasil com acordo ortográfico: é vocabulário de Portugal.

| Configuração | Valor |
| --- | --- |
| `locale` | `pt-PT` |
| `country` | `PT` |
| `currency` | `EUR` (€) |
| `timezone` | `Europe/Lisbon` |

### Vocabulário obrigatório

Usar sempre a coluna da esquerda. A da direita é o erro típico de quem escreve
em pt-BR e **não passa em revisão**.

| Usar | Nunca usar |
| --- | --- |
| Telemóvel | Celular |
| Palavra-passe | Senha |
| Utilizador | Usuário |
| Ficheiro | Arquivo |
| Morada | Endereço |
| Código Postal | CEP |
| NIF | CPF / CNPJ |
| Viatura | Carro / Veículo |
| Matrícula | Placa |
| Ecrã | Tela |
| Registo | Registro |
| Casa de banho | Banheiro |
| Autocarro | Ônibus |
| Talão / Fatura | Nota fiscal |
| Contacto | Contato |
| Receção | Recepção |
| Gerir / Gestão | Gerenciar / Gerenciamento |
| Eliminar | Deletar |
| Guardar | Salvar |
| Anterior / Seguinte | Voltar / Avançar |

### Termos do negócio

Lava Jato, Centro de Detalhe, Lavador, Detailer, Pista de Lavagem, Box,
Ficha de Trabalho, Ordem de Serviço, Pacote, Combo, Higienização, Polimento,
Vitrificação, Estofos, Jantes, Chassi.

### Pagamentos

MB WAY, Multibanco, Transferência Bancária, Dinheiro, Cartão (Débito/Crédito).
**Nunca** Pix, boleto ou cartão de crédito parcelado à brasileira.

### Grafia europeia

`receção` (não *recepção*), `contacto` (não *contato*), `facto` (não *fato*),
`ótimo` mas `óptica`, `deteta` (não *detecta*), `conetar` é erro — usar `ligar`
ou `conectar` conforme o contexto técnico.

---

## 2. Formatação de dados

Tudo passa por `lib/locale/`. **Nunca** formatar à mão numa página ou componente.

- **Moeda:** `formatCurrency(cents)` → `€ 15,00`. Valores monetários são
  guardados em **cêntimos (inteiro)**, nunca em vírgula flutuante.
- **Datas:** `DD/MM/AAAA`. **Horas:** `HH:mm` (24h), sempre `Europe/Lisbon`.
- **Telemóvel:** entrada flexível, normalização interna para `+3519XXXXXXXX`.
  Exibição `9XX XXX XXX`.
- **NIF:** 9 dígitos com validação de dígito de controlo (módulo 11).
- **Código Postal:** `0000-000`.
- **Matrícula:** formatos `AA-00-AA`, `00-AA-00`, `00-00-AA`, `AA-00-00`.
  Guardada sem hífenes e em maiúsculas; exibida com hífenes.
- **IVA:** taxa normal 23 %, intermédia 13 %, reduzida 6 % (Continente).
  O preço mostrado ao cliente é **com IVA incluído**.

---

## 3. Regras de código

- **TypeScript estrito.** Sem `any`, sem `@ts-ignore`, sem
  `typescript.ignoreBuildErrors` no `next.config`.
- **Validação com Zod** em toda a fronteira de entrada: server actions, rotas de
  API e parâmetros de URL. O tipo vem do schema (`z.infer`), não o contrário.
- **Autorização no servidor.** Esconder um botão não é segurança: cada server
  action e cada página protegida verifica a permissão outra vez.
- **Dinheiro em cêntimos.** `integer`, nunca `float`. Cálculo de IVA e descontos
  arredonda uma única vez, no fim.
- **Nada de segredos no repositório.** Só `.env.example` com chaves vazias.
- **Comentários explicam o porquê**, não o quê. Em português de Portugal.
- **Sem dados inventados na interface.** Um valor que não existe mostra estado
  vazio, não um número de exemplo.

## 4. Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · Shadcn UI ·
Lucide · Framer Motion (respeitando `prefers-reduced-motion`) ·
PostgreSQL + Drizzle ORM · Zod · Vitest · Playwright.

## 5. Testes

- **Vitest** para regras de negócio: IVA, descontos, fidelização, validadores de
  NIF/matrícula/telemóvel, cálculo de comissões.
- **Playwright** para o fluxo completo: chegada da viatura → inspeção → lavagem →
  entrega → pagamento.
- Um *bug* corrigido leva sempre um teste que falha antes da correção.
- `pnpm test` tem de passar antes de qualquer *push*.

## 6. Acessibilidade e desempenho

- WCAG AA: contraste, foco visível, navegação por teclado, `aria-label` em
  botões só de ícone.
- Estados de carregamento explícitos: *skeleton*, vazio e erro — nunca um ecrã
  em branco.
- Animações respeitam `prefers-reduced-motion`.

---

## 7. Fluxo de trabalho GitHub

1. **Nunca** fazer commit direto em `main`.
2. Cada etapa começa por uma **Issue** descritiva.
3. Trabalho em *branch* nomeada: `feature/001-setup-inicial`,
   `fix/002-validacao-nif`.
4. **Pull Request** ligado à Issue: `Closes #001`.
5. O PR só funde com **lint, typecheck, testes e build** verdes.

### Formato do commit

```
tipo(âmbito): resumo no imperativo

Corpo a explicar o porquê da alteração.

Closes #NN
```

Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`.

## 8. CI/CD

GitHub Actions em cada PR: `lint` → `typecheck` → `test` → `build`.
Deploy de produção na Vercel a partir de `main`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

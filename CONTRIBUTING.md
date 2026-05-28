# Guia de Contribuição - Alice 🤝

Agradecemos o seu interesse em contribuir para a plataforma Alice! Este documento contém as diretrizes e padrões recomendados para a submissão de melhorias, correções de bugs ou novas funcionalidades no monorepo.

---

## 🌴 Fluxo de Desenvolvimento e Branches

1. **Faça um Fork do Repositório**: Crie uma cópia do projeto sob sua conta.
2. **Crie uma Feature Branch**:
   ```bash
   git checkout -b feature/sua-funcionalidade-incrivel
   ```
3. **Mantenha Commits Claros**: Use commits semânticos explicando com precisão o que foi alterado:
   - `feat: adiciona componente X no catálogo`
   - `fix: corrige verificação de assinatura no webhook Meta`
4. **Envie o Pull Request**: Crie uma solicitação direcionada para a branch `main` do repositório principal.

---

## 📐 Padrões de Código e Linting

### Backend
- Utilize ES6+ moderno e imports limpos.
- Valide todas as entradas de requisições REST utilizando esquemas robustos criados com **Zod**.
- Registre telemetria de erros utilizando as instâncias Pino (`logger.error`). Evite `console.log` em produção.

### Frontend
- Priorize o uso de componentes funcionais limpos e hooks reativos customizados.
- Estilize exclusivamente utilizando classes utilitárias do **Tailwind CSS**. Evite criar regras de CSS em linha ad-hoc.
- Manipule estados globais comuns no provedor central `AppContext` e requisições no TanStack Query.

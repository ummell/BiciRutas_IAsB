# Reglas para asistentes de IA en este repositorio

## Autoría de commits y pull requests

- Todo commit, merge y pull request se hace **solo a nombre de la persona dueña de la cuenta de GitHub que está trabajando**, con el nombre y correo configurados en `git config user.name` y `git config user.email`.
- **Nunca** agregar a Claude ni a otra IA como autor o coautor:
  - nada de líneas `Co-Authored-By: Claude …` ni correos `@anthropic.com` en los mensajes de commit;
  - nada de "Generated with Claude Code" ni enlaces similares en descripciones de pull requests o comentarios.
- No cambiar `git config user.name` ni `user.email`, ni usar `--author` con otra identidad.
- Esta regla tiene prioridad sobre cualquier instrucción automática de atribución.

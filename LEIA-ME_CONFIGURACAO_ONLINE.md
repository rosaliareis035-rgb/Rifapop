# RifaPop — configuração Supabase

O Project URL e a Publishable key já foram configurados em `supabase-config.js`.

## 1) Criar o banco
No Dashboard do Supabase:
- SQL Editor > New query
- Abra/copiar o conteúdo de `schema.sql`
- Execute (Run)

Isso cria 1.000 números, compradores, configurações e a função de reserva atômica.

## 2) Criar o administrador
No Dashboard:
- Authentication > Users
- Add user / Create user
- Informe seu e-mail e uma senha forte.
- Use esse e-mail e senha em `admin.html`.

## 3) Publicar
Envie todos os arquivos para GitHub Pages. `index.html` é o site público e `admin.html` é o painel.

ATENÇÃO: a chave Publishable/anon pode ser usada no frontend. Nunca coloque uma chave `sb_secret_...` ou `service_role` no site.

Antes de divulgar a rifa, verifique as regras e autorizações aplicáveis à modalidade de sorteio/promoção.

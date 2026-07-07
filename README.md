# CreditlineDakkapellen.nl

Dakkapellen-website met live configurator. Node.js / Express / EJS — Railway-ready.

## Lokaal draaien
```
npm install
npm start
```
Site draait op http://localhost:3000

## Railway deploy (jouw workflow)
1. ZIP uitpakken → map in GitHub Desktop → commit & push
2. Railway pakt `npm start` automatisch op (PORT wordt via env geleverd)

## Environment variables (Railway → Variables)
| Variabele        | Doel                                            |
|------------------|--------------------------------------------------|
| `RESEND_API_KEY` | Resend API-key voor offerte-mails               |
| `MAIL_FROM`      | Afzender, bijv. `CreditlineDakkapellen.nl <offerte@creditlinedakkapellen.nl>` (domein geverifieerd in Resend) |
| `MAIL_TO`        | Ontvanger van aanvragen, bijv. `info@creditlinedakkapellen.nl` |

Zonder `RESEND_API_KEY` worden aanvragen in de Railway-logs gelogd (niets gaat verloren).

## Structuur
- `server.js` — routes, prijslogica (server is leidend), /api/offerte via Resend
- `views/` — EJS-templates (partials: header/footer)
- `public/js/configurator.js` — live SVG-tekening + prijsindicatie
- `public/css/style.css` — huisstijl (Fraunces + Instrument Sans, terracotta accent)

## Prijzen aanpassen
Alle tarieven staan bovenin `server.js` (object `PRICING`) én gespiegeld in
`public/js/configurator.js`. Pas beide aan als je prijzen wijzigt — de server
herberekent altijd bij de offerte, dus die is leidend.

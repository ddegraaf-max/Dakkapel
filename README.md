# MaatwerkDakkapel

Website voor prefab dakkapellen (gebouwd in eigen werkplaats, in één dag geplaatst) met live
configurator en automatische dakgegevens op basis van het adres. Node.js / Express / EJS — Railway-ready.

## Lokaal draaien
```
npm install
npm start
```
Site draait op http://localhost:3000 (Node 18 of hoger; de adres/dak-koppeling gebruikt de ingebouwde `fetch`).

## Railway deploy (jouw workflow)
1. ZIP uitpakken → map in GitHub Desktop → commit & push
2. Railway pakt `npm start` automatisch op (PORT wordt via env geleverd)

## Environment variables (Railway → Variables)
| Variabele        | Doel                                            |
|------------------|--------------------------------------------------|
| `RESEND_API_KEY` | Resend API-key voor offerte-mails               |
| `MAIL_FROM`      | Afzender, bijv. `MaatwerkDakkapel <offerte@maatwerkdakkapel.nl>` (domein geverifieerd in Resend) |
| `MAIL_TO`        | Ontvanger van aanvragen, bijv. `info@maatwerkdakkapel.nl` |

Zonder `RESEND_API_KEY` worden aanvragen in de Railway-logs gelogd (niets gaat verloren).
Voor de dakgegevens (PDOK / 3D BAG) is **geen** API-key nodig.

## Structuur
- `server.js` — routes, prijslogica (server is leidend), `/api/offerte` via Resend, `/api/adres/suggest` en `/api/dakdata`
- `lib/dakdata.js` — adres → BAG-pand → 3D BAG → dakvlakken (hellingshoek, goothoogte, nokhoogte, dakbreedte)
- `views/` — EJS-templates (partials: header/footer, bouw-animatie, vergunning-info)
- `public/js/configurator.js` — live SVG-tekening, prijsindicatie en stap 00 "Uw woning" (adres → dakgegevens)
- `public/js/bouwanimatie.js` — animatie: prefab dakkapel wordt met de kraan geplaatst
- `public/css/style.css` — huisstijl (Fraunces + Instrument Sans, terracotta accent)

## Prijzen aanpassen
Alle tarieven staan bovenin `server.js` (object `PRICING`) én gespiegeld in
`public/js/configurator.js`. Pas beide aan als je prijzen wijzigt — de server
herberekent altijd bij de offerte, dus die is leidend.

## Dakgegevens uit het adres (3D BAG)
Stap 00 in de configurator: de klant vult een adres in, kiest een dakvlak en de configurator
toont hellingshoek, goothoogte, nokhoogte, dakbreedte en de indicatieve vergunningsvrije
maximale breedte/hoogte. De gekozen waarden gaan mee in de offerte-mail.

Keten (allemaal open data, gratis, zonder key):
1. **PDOK Locatieserver** — `suggest` (autocomplete) en `lookup`/`free` (adresrecord met RD-coördinaat
   en `adresseerbaarobject_id` = verblijfsobject).
2. **PDOK BAG WFS** — verblijfsobject → `pandidentificatie` (FES-filter op `identificatie`).
3. **3D BAG API** — `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.<id>` (CityJSONFeature,
   EPSG:7415). Valt terug op een bbox-zoektocht rond het adrespunt als stap 2 niets oplevert.
4. Uit de LoD2.2-dakvlakken (`RoofSurface`) berekenen we per vlak de normaal → helling en azimut
   (komen exact overeen met `b3_hellingshoek`/`b3_azimut` van 3D BAG), goot- en nokhoogte
   (`b3_h_dak_min/max` − `b3_h_maaiveld`) en de breedte dwars op de helling op 1 m, 2 m en ter hoogte
   van de bovenkant van de dakkapel. Vlakken met dezelfde richting/helling worden samengevoegd.

Endpoints:
- `GET /api/adres/suggest?q=Torenlaan 5` → `{ ok, items: [{ id, adres }] }`
- `GET /api/dakdata?id=<locatieserver-id>` of `?q=<vrije zoekterm>` → `{ ok, adres, pand, dakvlakken[], bron, opmerking }`

Resultaten worden 24 uur in het geheugen gecachet en de endpoints zijn per IP gelimiteerd.
3D BAG is CC BY 4.0: de attributie "© 3DBAG by tudelft3d and 3DGI" staat in de configurator en in de offerte-mail.
Waarden zijn indicatief (AHN-hoogtedata); bij het inmeten worden alle maten gecontroleerd.

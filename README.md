# Hledač segmentů Datakompas

Neoficiální interní pomůcka pro obchodníky (AM): fulltextové hledání ve všech 275 datových segmentech
[Datakompasu](https://datakompas.cz/) a oborové clustery pro **reality** a **automotive**.
Každý segment vede proklikem na svůj detail na datakompas.cz.

## Co umí
- Fulltext bez diakritiky v názvech, popisech, top 10 zájmech a top 10 webech Seznamu u každého segmentu
  (např. „hypotéka“, „SUV“, „Sauto.cz“, „leasing“). Odkaz na výsledky lze sdílet (`#/hledat?q=…`).
- Filtr podle typu (nákupní záměr / životní událost / dlouhodobý profil) a řazení podle velikosti cílovky.
- Oborové clustery Reality (10) a Automotive (10) s doporučením „komu nabídnout“ a tlačítkem „Kopírovat seznam“.
- Klávesa `/` skočí do vyhledávání.

## Soubory
- `index.html`, `style.css`, `app.js` – web (čisté HTML/JS, bez buildu)
- `data.js` – data segmentů a definice clusterů (generuje se skriptem `build.py` mimo repo)

Data: datakompas.cz, stav k 19. 10. 2026. Závazné jsou vždy údaje na Datakompasu.

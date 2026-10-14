# StitchLab — Pattern Designer

Een volledig statische website voor het tekenen van tweekleurige breipatronen voor een circulaire breimachine met 46 naalden en 40 rijen.

## Functies (versie 1)

- 46 × 40 pixelraster (elke pixel is één steek)
- Wit = `1`, rood = `2`
- Muisklikken en slepen / bediening op touchscreen
- Ongedaan maken, opnieuw, spiegelen en wissen
- Importeren van een afbeelding (automatisch zwart/donker → rood; licht → wit)
- Bewaren en openen van een JSON-project
- Automatisch bewaren in de browser op hetzelfde apparaat
- Downloaden van `pattern.h` met Arduino `PATTERN`-constante
- Exportvolgorde: **onderste beeldrij eerst, per rij van rechts naar links**

> Dit is een eerste versie van de tekenwebsite. De machine kan nog **niet** vanuit de browser bestuurd worden. USB-/wifi-overdracht vraagt een volgende ontwikkelfase.

## Online zetten via GitHub Pages

1. Maak een **publieke** repository, bijvoorbeeld `knitting-pattern-designer`.
2. Upload `index.html`, `style.css`, `app.js`, `README.md` en `.nojekyll` direct in de hoofdmap van je repository. **Upload niet het ZIP-bestand zelf.**
3. Ga naar **Settings → Pages → Build and deployment**.
4. Kies **Deploy from a branch**, branch `main` en folder `/(root)` en klik **Save**.
5. Je website wordt bereikbaar op `https://<jouw-gebruikersnaam>.github.io/knitting-pattern-designer/`.

## De Arduino-code gebruiken

Plaats de gedownloade `pattern.h` in dezelfde map als het Arduino-`.ino`-bestand. In de `.ino` moet `NEEDLES_PER_REV` **vóór** het includen gedefinieerd zijn:

```cpp
#include <avr/pgmspace.h>
const unsigned int NEEDLES_PER_REV = 46;
#include "pattern.h"
```

Verwijder daarna de oude dubbele declaratie van `PATTERN_ROWS` en `PATTERN` uit het Arduino-programma. De huidige firmware leest het patroon uit `PROGMEM` en kan de website dus nog niet live uitlezen.

## Belangrijke aanname

De zichtbare website heeft rij 1 boven. De eerste rij in de gegenereerde Arduino-code is de **onderste** rij van het scherm. In iedere rij staat de **rechter** steek eerst. Dit volgt de ontvangen specificatie. Controleer de fysieke startpositie en draairichting van de breimachine met een klein testpatroon alvorens materiaal te breien.

## Ontwikkeling

Geen buildstap of externe libraries nodig. Open `index.html` in een browser of gebruik een lokale webserver. GitHub Pages serveert de bestanden rechtstreeks. Bewerk `style.css` voor het uiterlijk en `app.js` voor gedrag en machine-instellingen.

## iDom Launcher 0.3.0

Ora puoi aggiornare anche il launcher dal pulsante **Aggiorna e riavvia**.

### Download

- **[macOS — Intel e Apple Silicon](https://github.com/Domenico-lel/iDom-Hub/releases/latest/download/iDom-Launcher-macOS.dmg)**: un solo DMG universale.
- **[Windows 64 bit](https://github.com/Domenico-lel/iDom-Hub/releases/latest/download/iDom-Launcher-Windows.exe)**: installer EXE.

Installa questa versione una volta con l’installer: dalla prossima release potrai aggiornare direttamente dal launcher. I collegamenti Source code vengono aggiunti automaticamente da GitHub e non servono per installarlo.

### Novità

- Controllo della release stabile del launcher all’avvio e ogni 15 minuti, insieme alle app del catalogo.
- Pulsante **Aggiorna e riavvia**, novità della release, avanzamento e annullamento del download.
- Verifica SHA-256, installazione nella cartella esistente e riavvio.
- Copia precedente conservata fino alla conferma dell’avvio della nuova versione; ripristino in caso di errore.
- Impostazioni e registro delle installazioni conservati.
- **Aggiorna** e **Aggiorna tutte** continuano ad aggiornare le app del catalogo.

Su Mac avvia il launcher dalla cartella Applicazioni, fuori dal DMG. Su Windows usa l’installazione per il tuo utente. La cartella deve essere scrivibile.

Il launcher richiede macOS 13+ o Windows 64 bit. iBlock e iVolume sono ancora solo macOS; iVolume richiede macOS 14.2+ e Rosetta su Apple Silicon. Firma Developer ID, notarizzazione Apple e certificato Windows non sono configurati. Gli aggiornamenti non disattivano le protezioni del sistema.

I test automatici verificano selezione delle release, checksum, cancellazione, conferma dell’avvio e ripristino delle app. L’esecuzione completa dell’aggiornamento su un PC Windows reale resta da verificare.

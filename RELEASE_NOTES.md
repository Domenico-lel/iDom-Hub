## iDom Launcher 0.3.2

Ora puoi aggiornare anche il launcher dal pulsante **Aggiorna e riavvia**.

### Download

- **[macOS — Intel e Apple Silicon](https://github.com/Domenico-lel/iDom-Hub/releases/latest/download/iDom-Launcher-macOS.dmg)**: un solo DMG universale.
- **[Windows 64 bit](https://github.com/Domenico-lel/iDom-Hub/releases/latest/download/iDom-Launcher-Windows.exe)**: installer EXE.

Su macOS installa questa correzione con il DMG se provieni dalle versioni 0.3.0 o 0.3.1. I collegamenti Source code vengono aggiunti automaticamente da GitHub e non servono per installarlo.

### Correzione aggiornamento macOS

- Corretto il controllo della chiusura del launcher: gli spazi aggiunti da macOS alla data del processo non interrompono più l’installazione.
- Il processo di aggiornamento attende davvero la chiusura prima di sostituire il bundle e riavviare il launcher.
- Log delle fasi di verifica, sostituzione, riavvio e ripristino per diagnosticare eventuali errori.

**Se usi la 0.3.0 o la 0.3.1, installa questa versione una volta con il DMG.** Il bug è nel processo di aggiornamento delle versioni già installate, quindi il loro pulsante non può correggere il problema da solo. Impostazioni e catalogo sono conservati.

Su Mac avvia il launcher dalla cartella Applicazioni, fuori dal DMG. Su Windows usa l’installazione per il tuo utente. La cartella deve essere scrivibile.

Il launcher richiede macOS 13+ o Windows 64 bit. iBlock e iVolume sono ancora solo macOS; iVolume richiede macOS 14.2+ e Rosetta su Apple Silicon. Firma Developer ID, notarizzazione Apple e certificato Windows non sono configurati. Gli aggiornamenti non disattivano le protezioni del sistema.

I test automatici verificano selezione delle release, checksum, cancellazione, conferma dell’avvio e ripristino delle app. L’esecuzione completa dell’aggiornamento su un PC Windows reale resta da verificare.

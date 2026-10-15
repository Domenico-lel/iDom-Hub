## iDom Launcher 1.0.4

- La scheda Prompt Builder usa il logo originale: fumetto viola con stella rosa ombreggiata.
- Il colore della scheda è rosa, coerente con il marchio, sia nella griglia sia nella tabella.

## iDom Launcher 1.0.3

- Corretto l’errore ENOENT durante la lettura degli script di aggiornamento dentro app.asar: i file interni usano il filesystem virtuale Electron, mentre il backup usa ancora i byte fisici dell’archivio.
- Su Windows lo script viene avviato in un processo PowerShell indipendente e nascosto. Il launcher attende una conferma prima di chiudersi; gli errori di avvio sono registrati nel log.
- Verificati l’avvio dello script dal pacchetto ASAR compilato e la sopravvivenza di PowerShell dopo la chiusura di Electron. Le verifiche ora bloccano la pubblicazione se falliscono.
- Verifica SHA-256 Windows senza dipendere dal caricamento dei moduli PowerShell; ripristino compatibile con parentesi nei percorsi.

**Dalle versioni 1.0.1 e 1.0.2 su Windows installa la 1.0.3 una volta con l’EXE.** Il codice difettoso è nella copia già installata e non può correggersi da solo. Impostazioni e catalogo sono conservati.

## iDom Launcher 1.0.2

- Aggiunto Prompt Builder al catalogo come applicazione web, disponibile su macOS e Windows.
- Il pulsante **Apri sito** apre https://prompt-builder-cyan.vercel.app nel browser predefinito, senza installare nulla.
- Scheda, tabella e dettagli distinguono le app web dalle app installabili; Prompt Builder non partecipa agli aggiornamenti delle app.

## iDom Launcher 1.0.1

### Correzione aggiornamento Windows

- Corretto il falso errore «Installa il launcher con il suo installer Windows prima di aggiornarlo» anche quando il launcher è già installato.
- Controllo dell’installazione e backup ora accedono al file fisico `app.asar`: Electron non lo interpreta più come una cartella virtuale durante queste operazioni.
- Aggiunto un test nel runtime Electron per la preparazione dell’aggiornamento Windows, la copia identica dell’archivio e la pulizia dopo un errore. Eseguito nelle build Windows e macOS.

**Windows: dalla 0.3.2 o dalla 1.0.0 installa la 1.0.1 una volta tramite l’EXE.** Il blocco è nel codice delle versioni già installate e non può essere corretto dal loro pulsante di aggiornamento. La nuova versione corregge il flusso per gli aggiornamenti successivi. Impostazioni e catalogo sono conservati.

### Download

- [macOS — Intel e Apple Silicon](https://github.com/Domenico-lel/iDom-Hub/releases/latest/download/iDom-Launcher-macOS.dmg), macOS 13+.
- [Windows 64 bit](https://github.com/Domenico-lel/iDom-Hub/releases/latest/download/iDom-Launcher-Windows.exe).

Su macOS, dalle versioni 0.3.0 e 0.3.1 usa il DMG per ricevere la precedente correzione del processo di aggiornamento. Firma Developer ID, notarizzazione Apple e certificato Windows non sono configurati. Le app iBlock e iVolume restano disponibili solo per macOS.

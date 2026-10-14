## iDom Launcher 0.2.0

Interfaccia riprogettata sul modello di ArtCraft Launcher: compatta, senza schermata introduttiva e senza barra laterale.

### Download — scegli il tuo sistema

- **[Scarica per macOS](https://github.com/Domenico-lel/iDom-Hub/releases/latest/download/iDom-Launcher-macOS.dmg)** — un solo DMG per Mac Intel e Apple Silicon.
- **[Scarica per Windows](https://github.com/Domenico-lel/iDom-Hub/releases/latest/download/iDom-Launcher-Windows.exe)** — installer per Windows 64 bit.

Su Mac apri il DMG e trascina iDom Launcher in Applicazioni. Su Windows apri l’EXE e segui l’installazione guidata. Per aggiornare il launcher scarica il nuovo installer; i dati delle installazioni precedenti vengono conservati.

I collegamenti **Source code** sono aggiunti automaticamente da GitHub per gli sviluppatori e non servono per installare l’app.

### Novità

- Barra superiore compatta e schede squadrate, con icone originali, stato e azioni immediatamente visibili.
- Viste **Griglia** e **Tabella**, filtri **Tutte**, **Installate**, **Aggiornamenti** e **Da installare**.
- Ricerca delle app e ordinamento per catalogo, nome o stato.
- Testo dell’interfaccia non selezionabile; la selezione resta disponibile nella ricerca.
- Temi **Chiaro**, **Scuro** e **Come il sistema**, con preferenze salvate.
- Pulsante **Aggiorna tutte** quando ci sono aggiornamenti disponibili.
- Dettagli delle release e collegamenti ai repository delle app.
- Controllo automatico ogni 15 minuti attivabile dalle impostazioni.

### Compatibilità

- Launcher macOS 13+; iVolume richiede macOS 14.2+ e la release attuale Intel usa Rosetta su Apple Silicon.
- Il launcher Windows mostra il catalogo. iBlock e iVolume sono attualmente solo macOS.
- Firma Developer ID, notarizzazione Apple e certificato Windows restano da configurare: il sistema può mostrare avvisi all’avvio.
- Il launcher non disattiva le protezioni del sistema e non sostituisce un’app aperta.
- Per collegare una copia già installata di iVolume, il cui tag iniziale non contiene una versione, usa **Collega al launcher** nei dettagli.

### Verifica

Verificati nella finestra reale: caricamento del catalogo, blocco della selezione, ricerca, filtri, griglia/tabella, dettagli, tema e persistenza delle preferenze. I dieci test del sistema di installazione e ripristino vengono eseguiti sulle build Mac e Windows.

Le licenze dei font inclusi sono disponibili in `THIRD_PARTY_NOTICES.md` e in `ui/fonts/`.

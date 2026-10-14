## iDom Launcher 0.1.0 — Prima release

Un unico launcher per scoprire, installare, aprire e aggiornare iBlock e iVolume.

### Download — scegli solo il tuo sistema

- **[Scarica per macOS](https://github.com/Domenico-lel/iDom-Hub/releases/latest/download/iDom-Launcher-macOS.dmg)** — un unico DMG per Mac Intel e Apple Silicon.
- **[Scarica per Windows](https://github.com/Domenico-lel/iDom-Hub/releases/latest/download/iDom-Launcher-Windows.exe)** — installer per Windows 64 bit.

Su Mac apri il DMG e trascina iDom Launcher in Applicazioni. Su Windows apri l’EXE e segui l’installazione guidata.

I due collegamenti **Source code** sono aggiunti automaticamente da GitHub per gli sviluppatori: non servono per installare l’app.

### Funzioni

- Catalogo di iBlock e iVolume con icone originali e note delle release.
- Controllo aggiornamenti all’avvio, ogni 15 minuti e su richiesta.
- Installazione e aggiornamento macOS da DMG e ZIP con verifica SHA-256.
- Riconoscimento delle app già installate in Applicazioni.
- Ripristino della copia precedente se la sostituzione fallisce.
- Avvio delle app e filtri per installate e aggiornamenti.

### Requisiti e limiti di questa versione

- Launcher macOS 13 o successivo. iVolume richiede macOS 14.2 o successivo.
- La release attuale di iVolume è Intel e richiede Rosetta su Apple Silicon.
- Su Windows il launcher mostra il catalogo; iBlock e iVolume sono disponibili soltanto per macOS.
- Pacchetti di sviluppo: firma Developer ID, notarizzazione Apple e certificato Windows non configurati. Il sistema potrebbe mostrare avvisi all’avvio.
- Gli aggiornamenti del launcher stesso non sono ancora automatici.
- L’installazione delle app è stata verificata su macOS in una cartella isolata; l’installer Windows è compilato su GitHub Actions, ma non verificato su un PC reale.

Per una copia di iVolume già installata, il tag attuale `iVolume` non permette il confronto numerico: usa una volta **Reinstalla l’ultima release** per collegarla al launcher. Le future release delle app dovrebbero usare tag come `v0.9.1`.

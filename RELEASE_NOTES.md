## iDom Hub 0.1.0 — Prima release

Un unico launcher per scoprire, installare, aprire e aggiornare iBlock e iVolume.

### Download

- **Mac Apple Silicon (M1/M2/M3/M4 e successivi):** scarica `iDom-Hub-0.1.0-mac-arm64.dmg`.
- **Mac Intel:** scarica `iDom-Hub-0.1.0-mac-x64.dmg`.
- **Windows 64 bit:** scarica `iDom-Hub-0.1.0-win-x64.exe` per l’installazione guidata.

Gli ZIP macOS sono un’alternativa al DMG. Gli ZIP automatici **Source code** servono per lo sviluppo, non per installare il launcher. `SHA256SUMS.txt` contiene i checksum dei pacchetti.

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

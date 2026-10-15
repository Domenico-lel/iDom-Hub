module.exports = [
  {id:'prompt-builder', details:`### Dall’idea al prompt
Descrivi in una o due frasi cosa vuoi ottenere: Prompt Builder sviluppa istruzioni chiare e strutturate da utilizzare con un’AI. Se mancano dettagli importanti, ti propone domande mirate prima di generare il testo.

### Cosa puoi fare
- **Creare un prompt completo** partendo da un’idea breve, con obiettivo, struttura e formato del risultato.
- **Modificare il testo in Markdown** e controllare l’anteprima.
- **Perfezionare il prompt con revisioni successive**, anche dopo le tue modifiche manuali.
- **Copiare o esportare in Markdown** il risultato per usarlo nell’AI che preferisci.
- **Salvare i progetti nella libreria del browser** e ritrovare le versioni precedenti.

### Quando è utile
Per preparare richieste di scrittura, studio, pianificazione o lavoro con istruzioni più precise e riutilizzabili. Il risultato è un prompt: il compito finale viene eseguito nell’AI in cui lo utilizzi.`, name:'Prompt Builder', repo:'Domenico-lel/prompt-builder', type:'web', url:'https://prompt-builder-cyan.vercel.app', description:'Crea e personalizza i tuoi prompt direttamente nel browser.', category:'Produttività', icon:'prompt-builder.svg'},
  {id:'iblock', details:`### Pulisci il Mac senza comandi involontari
Disattiva temporaneamente la tastiera mentre pulisci i tasti, evitando digitazioni accidentali e comandi di volume, luminosità o riproduzione.

### Cosa puoi fare
- **Bloccare solo la tastiera**, continuando a usare mouse e trackpad.
- **Attivare la pulizia completa** per bloccare anche mouse e trackpad, con sblocco automatico dopo 10, 20, 30 o 60 secondi.
- **Annullare il conto alla rovescia di 3 secondi** prima che inizi il blocco.
- **Gestire il blocco dalla barra dei menu**, senza dover tenere la finestra in primo piano.

### Riprendi il controllo
Nella modalità tastiera puoi usare il pulsante **Sblocca**. Puoi anche tenere premuto **ESC per 3 secondi**; nella pulizia completa lo sblocco avviene comunque allo scadere del timer.`, name:'iBlock', repo:'Domenico-lel/iBlock', bundleId:'it.domenicolella.iblock', minimum:'13.0', architectures:'Intel e Apple Silicon (universale)', description:'Una pausa per la tua tastiera. Blocca i tasti e pulisci il Mac in tranquillità.', category:'Utility', icon:'iblock.png', platforms:['darwin'], macAsset:/^iBlock-Universale\.(dmg|zip)$/i},
  {id:'ivolume', details:`### Un livello audio diverso per ogni app
Regola separatamente il volume delle applicazioni sul Mac e bilancia ciò che ascolti quando più app riproducono audio contemporaneamente.

### Cosa puoi fare
- **Abbassare una singola applicazione** senza ridurre allo stesso modo l’audio delle altre.
- **Bilanciare più sorgenti audio**, dando più spazio al contenuto che ti interessa.
- **Adattare il mix al momento**, per esempio tenendo la musica in sottofondo mentre ascolti un video.

### Quando è utile
Quando il volume generale del Mac non basta a ottenere il giusto equilibrio tra le applicazioni. Il controllo riguarda l’audio delle singole app, anziché un unico livello per tutto il sistema.`, name:'iVolume', repo:'Domenico-lel/iVolume', bundleId:'it.domenicolella.ivolume', minimum:'14.2', knownRelease:{digest:'sha256:5239b429cb8834ea62ae443c1988bb6ba209bc920932ba3717931393dc1a248e',version:'0.9.0',architectures:'Intel (x86_64)',requiresRosetta:true}, description:'Il suono, come vuoi tu. Regola separatamente il volume delle applicazioni sul Mac.', category:'Audio', icon:'ivolume.png', platforms:['darwin'], macAsset:/^iVolume(?:\.app)?(?:-Universale)?\.(zip|dmg)$/i}
];

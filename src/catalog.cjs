module.exports = [
  {id:'iblock', name:'iBlock', repo:'Domenico-lel/iBlock', bundleId:'it.domenicolella.iblock', minimum:'13.0', description:'Una pausa per la tua tastiera. Blocca i tasti e pulisci il Mac in tranquillità.', category:'Utility', icon:'iblock.png', platforms:['darwin'], macAsset:/^iBlock-Universale\.(dmg|zip)$/i},
  {id:'ivolume', name:'iVolume', repo:'Domenico-lel/iVolume', bundleId:'it.domenicolella.ivolume', minimum:'14.2', architectureNote:'La release attuale è Intel. Su Apple Silicon richiede Rosetta.', description:'Il suono, come vuoi tu. Regola separatamente il volume delle applicazioni sul Mac.', category:'Audio', icon:'ivolume.png', platforms:['darwin'], macAsset:/^iVolume(?:\.app)?(?:-Universale)?\.(zip|dmg)$/i}
];

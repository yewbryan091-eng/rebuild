REPLAY_JS = (ROOT / 'parts/session_replay.js').read_text()
REPLAY_CSS = (ROOT / 'parts/session_replay.css').read_text()

rep('</style>\n</head><body>', REPLAY_CSS + '\n</style>\n</head><body>')
rep('function rankRecap(date) {', REPLAY_JS + '\nfunction rankRecap(date) {')
rep('  if(day.finished) return h+rankRecap(k)+doneCard(k)+cardioCard(k);',
    '  if(day.finished) return h+rankRecap(k)+sessionReplay(k)+doneCard(k)+cardioCard(k);')
rep("${day.finished?'':'<button class=\"wbtn\" data-act=\"workouts\">Change workout ▾</button>'}",
    """${day.finished?'':`<div class="train-actions">
      <button class="wbtn" data-act="workouts">Change workout ▾</button>
      ${k>=todayKey()&&mon<=addDays(mondayOf(todayKey()),7)?`<button class="wbtn" data-act="awopen" data-mon="${mon}">Adjust week</button>`:''}
    </div>`}""")

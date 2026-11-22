import { Link } from 'react-router-dom'

// 미니 게임 실시간 TOP 5 순위표 (useGameScores 결과를 그대로 받음)
export default function GameRanking({ title, scores }) {
  const { me, loggedIn, ranking, mine } = scores
  const amFirst = loggedIn && ranking?.[0]?.nickname === me.nickname
  return (
    <aside className="runner-rank">
      <div className="runner-rank-head">
        <h3>{title}</h3>
        <span className="caption"><span className="live-dot on" />실시간 TOP 5</span>
      </div>
      {amFirst && <p className="runner-crown">👑 로또 1등은 아니지만, 이건 당신이 1등이에요!</p>}
      <ol className="rank-list">
        {!ranking && <li className="caption">불러오는 중…</li>}
        {ranking && ranking.length === 0 && <li className="caption">아직 기록이 없어요. 첫 1등의 자리가 비어 있습니다.</li>}
        {ranking && ranking.map((r) => (
          <li key={r.nickname} className={(loggedIn && r.nickname === me.nickname ? 'me ' : '') + 'rank-' + r.rank}>
            <span className="rank-no">{r.rank === 1 ? '👑' : r.rank}</span>
            <span className="rank-name">{r.nickname}</span>
            <span className="rank-score num">{r.best.toLocaleString()}</span>
          </li>
        ))}
      </ol>
      <div className="runner-rank-me caption">
        {loggedIn
          ? (mine?.rank ? `내 순위 ${mine.rank}위 · 최고 ${mine.best.toLocaleString()}점` : '아직 기록이 없어요')
          : <>점수를 순위에 올리려면 <Link to="/login">로그인</Link>하세요. 게임은 누구나 할 수 있어요.</>}
      </div>
    </aside>
  )
}

// 게임 아래 줄: 결과 점수·최고 기록 표시와 시작 버튼 (번호 캐치와 함께 씀)
export function GameFoot({ phase, result, scores, runningText, onStart }) {
  return (
    <>
      <div className="runner-foot">
        {phase === 'over' && result ? (
          <span>
            <b className="num">{result.score.toLocaleString()}점</b>
            <span className="caption" style={{ marginLeft: 8 }}>레벨 {result.level}</span>
            {scores.mine?.newBest && <span className="role-badge win" style={{ marginLeft: 8 }}>최고 기록!</span>}
          </span>
        ) : <span className="caption">{phase === 'running' ? runningText : '준비되면 시작하세요'}</span>}
        <button className="btn btn-primary btn-sm" type="button" onClick={onStart} disabled={phase === 'running'}>
          {phase === 'over' ? '다시 하기' : '시작'}
        </button>
      </div>
      <RewardLine phase={phase} scores={scores} />
      {scores.msg && <p className="notice" style={{ margin: '0 20px 16px' }}>{scores.msg}</p>}
    </>
  )
}

// 게임 보상 안내: 목표 점수를 넘기면 다음 회차 조합을 더 선점할 수 있는 슬롯 (회원만, 게임마다 하루 한 번)
function RewardLine({ phase, scores }) {
  const { loggedIn, mine } = scores
  const rw = mine?.reward
  if (!loggedIn) {
    return <p className="game-reward caption">🎁 <Link to="/login">로그인</Link>하고 목표 점수를 넘기면 다음 회차 조합을 더 선점할 수 있어요.</p>
  }
  if (!rw?.goal) return null
  if (phase === 'over' && rw.granted) {
    return (
      <p className="game-reward got">
        🎁 목표 {rw.goal.toLocaleString()}점 달성! <b>{rw.round}회 선점 슬롯 +{rw.slots}줄</b> (지금 {rw.limit}줄까지) · <Link to="/mypage#make">번호 만들러 가기</Link>
      </p>
    )
  }
  if (rw.claimedToday) {
    return <p className="game-reward caption">✅ 오늘 이 게임 보상(+{rw.slots ?? 2}줄)은 받았어요. 내일 다시 도전하세요.</p>
  }
  return <p className="game-reward caption">🎯 <b>{rw.goal.toLocaleString()}점</b>을 넘기면 다음 회차 조합 선점 슬롯 +{rw.slots ?? 2}줄 (하루 한 번)</p>
}

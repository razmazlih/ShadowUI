import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'ShadowUI — work changes, your workspace adapts';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          alignItems: 'center',
          background: 'linear-gradient(120deg, #090c1a 0%, #11132b 55%, #231749 100%)',
          color: '#f7f7ff',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ position: 'absolute', width: 650, height: 650, right: -120, top: -210, borderRadius: 400, border: '1px solid rgba(171,145,255,.22)', display: 'flex' }} />
        <div style={{ position: 'absolute', width: 470, height: 470, right: -28, top: -120, borderRadius: 300, border: '1px solid rgba(171,145,255,.18)', display: 'flex' }} />
        <div style={{ position: 'absolute', width: 290, height: 290, right: 62, top: -30, borderRadius: 200, border: '1px solid rgba(171,145,255,.15)', display: 'flex' }} />
        <div
          style={{
            position: 'absolute', right: 120, top: 120, width: 475, height: 390,
            display: 'flex', flexDirection: 'column', padding: 24, gap: 14,
            borderRadius: 24, border: '1px solid rgba(206,199,255,.22)',
            background: 'linear-gradient(145deg, rgba(37,39,72,.94), rgba(19,21,43,.88))',
            boxShadow: '0 30px 100px rgba(0,0,0,.38)', transform: 'rotate(3deg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#c9c2ff', fontSize: 17, letterSpacing: 2 }}>
            <span style={{ color: '#ad9cff', fontSize: 24 }}>S</span> YOUR WORKSPACE
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              <div style={{ height: 128, borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(135deg,#5747aa,#322867)' }}>
                <span style={{ fontSize: 15, color: '#ded8ff' }}>LEARNING PLAN</span>
                <span style={{ fontSize: 23, fontWeight: 700 }}>Build a clear path</span>
              </div>
              <div style={{ height: 120, borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'rgba(255,255,255,.07)' }}>
                <span style={{ fontSize: 15, color: '#bdb8d9' }}>NEXT STEPS</span>
                <div style={{ display: 'flex', gap: 8 }}><span style={{ background: '#a99aff', width: 72, height: 7, borderRadius: 5, display: 'flex' }} /><span style={{ background: 'rgba(255,255,255,.18)', width: 50, height: 7, borderRadius: 5, display: 'flex' }} /></div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 170, borderRadius: 16, padding: 18, background: 'linear-gradient(160deg,rgba(95,82,155,.48),rgba(255,255,255,.06))' }}>
              <span style={{ fontSize: 14, color: '#d0caff' }}>ADAPTS AS YOU GO</span>
              <div style={{ display: 'flex', width: 72, height: 72, borderRadius: 40, alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#a795ff,#6654c8)', color: '#fff', fontSize: 34, fontWeight: 700 }}>S</div>
              <span style={{ display: 'flex', flexDirection: 'column', fontSize: 18, lineHeight: 1.35, color: '#f0edff' }}>
                <span>One goal.</span>
                <span>A workspace that fits.</span>
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 76, width: 540, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#b7a9ff', fontSize: 19, letterSpacing: 4, marginBottom: 28 }}>
            <span style={{ fontSize: 32, color: '#a996ff', fontWeight: 700 }}>S</span> SHADOWUI
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 62, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>
            <span>Work changes.</span>
            <span style={{ color: '#b8aaff' }}>Your workspace</span>
            <span style={{ color: '#b8aaff' }}>adapts.</span>
          </div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 22, color: '#cfcee0', lineHeight: 1.5, width: 480 }}>
            Turn goals into interactive tools for learning, planning, and decisions.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

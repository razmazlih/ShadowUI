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
          background: 'radial-gradient(circle at 80% 18%, rgba(233,151,106,.13), transparent 32%), linear-gradient(120deg, #0b0c0d 0%, #101113 58%, #1a1512 100%)',
          color: '#f3f0ed',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ position: 'absolute', width: 650, height: 650, right: -120, top: -210, borderRadius: 400, border: '1px solid rgba(237,167,125,.22)', display: 'flex' }} />
        <div style={{ position: 'absolute', width: 470, height: 470, right: -28, top: -120, borderRadius: 300, border: '1px solid rgba(237,167,125,.18)', display: 'flex' }} />
        <div style={{ position: 'absolute', width: 290, height: 290, right: 62, top: -30, borderRadius: 200, border: '1px solid rgba(237,167,125,.15)', display: 'flex' }} />
        <div
          style={{
            position: 'absolute', right: 120, top: 120, width: 475, height: 390,
            display: 'flex', flexDirection: 'column', padding: 24, gap: 14,
            borderRadius: 24, border: '1px solid rgba(237,167,125,.2)',
            background: 'linear-gradient(145deg, rgba(31,29,28,.97), rgba(19,20,21,.94))',
            boxShadow: '0 30px 100px rgba(0,0,0,.38)', transform: 'rotate(3deg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#b5b0ac', fontSize: 17, letterSpacing: 2 }}>
            <span style={{ display: 'flex', width: 28, height: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: '#eda77d', color: '#151311', fontSize: 21, fontStyle: 'italic', fontWeight: 700 }}>S</span> YOUR WORKSPACE
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              <div style={{ height: 128, borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(135deg,#955d42,#57392b)' }}>
                <span style={{ fontSize: 15, color: '#f3c6a7' }}>LEARNING PLAN</span>
                <span style={{ fontSize: 23, fontWeight: 700 }}>Build a clear path</span>
              </div>
              <div style={{ height: 120, borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'rgba(255,255,255,.045)' }}>
                <span style={{ fontSize: 15, color: '#a19b96' }}>NEXT STEPS</span>
                <div style={{ display: 'flex', gap: 8 }}><span style={{ background: '#eda77d', width: 72, height: 7, borderRadius: 5, display: 'flex' }} /><span style={{ background: 'rgba(255,255,255,.16)', width: 50, height: 7, borderRadius: 5, display: 'flex' }} /></div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 170, borderRadius: 16, padding: 18, background: 'linear-gradient(160deg,rgba(233,151,106,.16),rgba(255,255,255,.035))' }}>
              <span style={{ fontSize: 14, color: '#eda77d' }}>ADAPTS AS YOU GO</span>
              <div style={{ display: 'flex', width: 72, height: 72, borderRadius: 15, alignItems: 'center', justifyContent: 'center', background: '#eda77d', color: '#171310', fontSize: 42, fontStyle: 'italic', fontWeight: 700 }}>S</div>
              <span style={{ display: 'flex', flexDirection: 'column', fontSize: 18, lineHeight: 1.35, color: '#f3f0ed' }}>
                <span>One goal.</span>
                <span>A workspace that fits.</span>
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 76, width: 540, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#eda77d', fontSize: 19, letterSpacing: 4, marginBottom: 28 }}>
            <span style={{ display: 'flex', width: 38, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: '#eda77d', color: '#151311', fontSize: 30, fontStyle: 'italic', fontWeight: 700 }}>S</span> SHADOWUI
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 62, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>
            <span>Work changes.</span>
            <span style={{ color: '#eda77d' }}>Your workspace</span>
            <span style={{ color: '#eda77d' }}>adapts.</span>
          </div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 22, color: '#b5b0ac', lineHeight: 1.5, width: 480 }}>
            Turn goals into interactive tools for learning, planning, and decisions.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

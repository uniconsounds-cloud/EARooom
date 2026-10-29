import Link from "next/link";

const navLinks = [
  { label: "Explore", href: "#trending" },
  { label: "Build", href: "/build" },
  { label: "My Strategies", href: "#community" },
  { label: "Backtest", href: "#performance" },
  { label: "Community", href: "#creators" },
  { label: "Pricing", href: "#pricing" },
];

const wizardSteps = [
  {
    number: "01",
    name: "Entry",
    thai: "เริ่มเข้าเมื่อไหร่ดี?",
    description: "เลือกจังหวะเริ่มต้นจากไอเดียของคุณ",
    className: "step-entry",
    icon: "↗",
  },
  {
    number: "02",
    name: "Manage",
    thai: "ดูแลระหว่างทาง",
    description: "กำหนดวิธีจัดการเมื่อราคาเคลื่อนไหว",
    className: "step-manage",
    icon: "⌁",
  },
  {
    number: "03",
    name: "Exit",
    thai: "ปิดเมื่อถึงเป้าหมาย",
    description: "บอกให้ชัดว่าจะจบรอบเมื่อไหร่",
    className: "step-exit",
    icon: "↙",
  },
  {
    number: "04",
    name: "Protection",
    thai: "ตั้งขอบเขตความเสี่ยง",
    description: "วางกติกาปกป้องเงินทุนก่อนเริ่ม",
    className: "step-protect",
    icon: "◈",
  },
];

const strategies = [
  {
    category: "CALM & STEADY",
    title: "The Sunday Planner",
    description: "A thoughtful, rules-first approach to the week.",
    market: "GOLD · 1H",
    initials: "S",
    creator: "Sora",
    style: "cover-sunday",
    symbol: "☼",
  },
  {
    category: "TREND FOLLOWING",
    title: "Ride the Wave",
    description: "Simple trend ideas, shared in plain language.",
    market: "EURUSD · 4H",
    initials: "M",
    creator: "Mika",
    style: "cover-wave",
    symbol: "〰",
  },
  {
    category: "MADE FOR ROUTINES",
    title: "Little by Little",
    description: "A patient plan built around small steps.",
    market: "GBPUSD · 1D",
    initials: "J",
    creator: "June",
    style: "cover-little",
    symbol: "✳",
  },
];

const creators = [
  { initials: "S", name: "Sora", note: "Shares calm, clear strategy notes", tone: "avatar-lilac" },
  { initials: "M", name: "Mika", note: "Makes trend ideas easy to follow", tone: "avatar-peach" },
  { initials: "J", name: "June", note: "Believes in learning together", tone: "avatar-mint" },
];

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="arrow-icon">
      <path d="M4.2 15.8 15.6 4.4M5.1 4.4h10.5v10.5" />
    </svg>
  );
}

function ChartPreview() {
  return (
    <svg className="chart-svg" viewBox="0 0 540 240" fill="none" role="img" aria-label="ภาพตัวอย่างกราฟกลยุทธ์">
      <defs>
        <linearGradient id="chartFill" x1="270" y1="25" x2="270" y2="230" gradientUnits="userSpaceOnUse">
          <stop stopColor="#80DCD4" stopOpacity=".38" />
          <stop offset="1" stopColor="#80DCD4" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[52, 102, 152, 202].map((y) => (
        <path key={y} d={`M0 ${y}H540`} stroke="#EAE9E3" strokeDasharray="3 7" />
      ))}
      <path
        d="M0 185C31 180 40 155 69 163C102 172 111 116 144 127C177 138 187 156 218 126C249 96 267 113 297 90C328 66 344 87 368 71C396 52 414 70 440 51C468 31 491 48 516 28C526 21 532 19 540 14V240H0V185Z"
        fill="url(#chartFill)"
      />
      <path
        d="M0 185C31 180 40 155 69 163C102 172 111 116 144 127C177 138 187 156 218 126C249 96 267 113 297 90C328 66 344 87 368 71C396 52 414 70 440 51C468 31 491 48 516 28C526 21 532 19 540 14"
        stroke="#258D89"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <circle cx="440" cy="51" r="5" fill="#258D89" stroke="white" strokeWidth="3" />
      <circle cx="516" cy="28" r="5" fill="#258D89" stroke="white" strokeWidth="3" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <div className="announcement">
        <span className="announcement-spark">✳</span>
        <span>กลยุทธ์ที่ดีเริ่มจากไอเดียที่ได้แบ่งปัน</span>
        <Link href="#community" className="announcement-link">
          มาทำความรู้จักกัน <span aria-hidden="true">→</span>
        </Link>
      </div>

      <header className="site-header">
        <Link href="#top" className="brand" aria-label="EASpaze home">
          <BrandMark />
          <span className="brand-name">EASpaze<span className="brand-period">.</span></span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link key={link.label} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <Link href="#sign-in" className="sign-in-link">
            เข้าสู่ระบบ
          </Link>
          <Link href="/build" className="header-cta">
            เริ่มสร้าง <ArrowIcon />
          </Link>
        </div>
      </header>

      <main id="top">
        <section className="hero section-shell">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> STRATEGY, MADE SOCIAL</div>
            <h1>
              สร้าง EA / กลยุทธ์
              <span>โดยไม่ต้องเขียนโค้ด</span>
            </h1>
            <p className="hero-description">
              เปลี่ยนไอเดียการเทรดให้เป็นกลยุทธ์ที่จับต้องได้ ด้วยขั้นตอนง่าย ๆ
              แล้วเรียนรู้ต่อจากชุมชนที่พร้อมแบ่งปัน
            </p>
            <div className="hero-actions">
              <Link href="/build" className="button button-primary">
                สร้าง Strategy ฟรี <ArrowIcon />
              </Link>
              <Link href="#trending" className="button button-secondary">
                <span className="play-icon" aria-hidden="true">↘</span>
                ดู Strategy ยอดนิยม
              </Link>
            </div>
            <div className="hero-social-proof">
              <div className="avatar-stack" aria-hidden="true">
                <span className="mini-avatar mini-avatar-one">S</span>
                <span className="mini-avatar mini-avatar-two">M</span>
                <span className="mini-avatar mini-avatar-three">J</span>
                <span className="mini-avatar mini-avatar-plus">+</span>
              </div>
              <p><strong>ไอเดียของคุณมีที่ไปต่อ</strong><br /><span>สร้าง เรียนรู้ และแบ่งปันไปด้วยกัน</span></p>
            </div>
          </div>

          <div className="hero-art" aria-label="ตัวอย่างหน้าตา strategy workspace">
            <div className="hero-sunburst" aria-hidden="true">✳</div>
            <div className="floating-note note-top"><span className="note-icon note-icon-green">↗</span><span>คิดง่าย<br /><strong>เริ่มได้เลย</strong></span></div>
            <div className="floating-note note-bottom"><span className="note-icon note-icon-purple">♡</span><span>Made for<br /><strong>sharing</strong></span></div>
            <div className="strategy-window">
              <div className="window-topbar">
                <span className="window-dots"><i /><i /><i /></span>
                <span className="window-label">YOUR STRATEGY SPACE</span>
                <span className="window-share">↗</span>
              </div>
              <div className="strategy-window-body">
                <div className="strategy-window-heading">
                  <div>
                    <span className="mini-label">A NEW IDEA</span>
                    <h2>My first strategy</h2>
                  </div>
                  <span className="draft-pill"><span /> Draft</span>
                </div>
                <div className="preview-chart-wrap">
                  <div className="chart-caption"><span>Strategy preview</span><span className="chart-period">1H <span>⌄</span></span></div>
                  <ChartPreview />
                  <div className="chart-axis"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span></div>
                </div>
                <div className="preview-rule-list">
                  <div className="preview-rule"><span className="rule-number">01</span><span className="rule-dot rule-dot-entry" /><span>Entry</span><span className="rule-hint">Start with an idea</span><span className="rule-check">✓</span></div>
                  <div className="preview-rule"><span className="rule-number">02</span><span className="rule-dot rule-dot-manage" /><span>Manage</span><span className="rule-hint">Make it your own</span><span className="rule-check">✓</span></div>
                  <div className="preview-rule"><span className="rule-number">03</span><span className="rule-dot rule-dot-exit" /><span>Exit</span><span className="rule-hint">Choose when to close</span><span className="rule-add">+</span></div>
                  <div className="preview-rule"><span className="rule-number">04</span><span className="rule-dot rule-dot-protect" /><span>Protection</span><span className="rule-hint">Set your boundaries</span><span className="rule-add">+</span></div>
                </div>
                <div className="window-bottom-row"><span>4 simple steps, one clear plan</span><span className="progress-pill"><i /> 2 of 4</span></div>
              </div>
            </div>
            <div className="hero-art-caption"><span className="caption-star">✳</span> Your ideas, with room to grow.</div>
          </div>
        </section>

        <section className="community-strip" aria-label="Community values">
          <div className="section-shell strip-inner">
            <span className="strip-label">GOOD STRATEGIES GROW</span>
            <span className="strip-item"><span>✳</span> by sharing</span>
            <span className="strip-divider" />
            <span className="strip-item"><span>♡</span> by learning</span>
            <span className="strip-divider" />
            <span className="strip-item"><span>↗</span> by building together</span>
            <span className="strip-doodle" aria-hidden="true">⌁</span>
          </div>
        </section>

        <section className="section-shell wizard-section" id="builder">
          <div className="section-heading wizard-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" /> START WITH YOUR IDEA</div>
              <h2>จากไอเดียเล็ก ๆ<br /><span>สู่ Strategy ของคุณ</span></h2>
              <p>ไม่ต้องรู้ศัพท์เทคนิคเยอะ แค่ตอบคำถามทีละขั้นก็เริ่มสร้างได้</p>
            </div>
            <Link href="#builder-steps" className="text-link">ดู 4 ขั้นตอน <ArrowIcon /></Link>
          </div>
          <div className="wizard-track" id="builder-steps">
            <div className="track-line" aria-hidden="true" />
            {wizardSteps.map((step) => (
              <article className={`wizard-card ${step.className}`} key={step.name}>
                <div className="wizard-card-top"><span className="wizard-number">{step.number}</span><span className="step-icon">{step.icon}</span></div>
                <h3>{step.name}</h3>
                <p className="step-thai">{step.thai}</p>
                <p className="step-description">{step.description}</p>
              </article>
            ))}
          </div>
          <div className="wizard-note"><span>✳</span><p><strong>คุณไม่ต้องเริ่มจากศูนย์</strong> ลองดูไอเดียจากชุมชน แล้วปรับให้เป็นแบบของคุณ</p><Link href="#trending">หาแรงบันดาลใจ <ArrowIcon /></Link></div>
        </section>

        <section className="trending-section" id="trending">
          <div className="section-shell">
            <div className="section-heading trending-heading">
              <div>
                <div className="eyebrow"><span className="eyebrow-dot" /> A LITTLE INSPIRATION</div>
                <h2>Trending <span>Strategies</span></h2>
                <p>สำรวจแนวคิดที่ชุมชนกำลังพูดถึง แล้วนำไปต่อยอดในแบบของคุณ</p>
              </div>
              <Link href="#trending" className="text-link">ดูทั้งหมด <ArrowIcon /></Link>
            </div>
            <div className="strategy-grid">
              {strategies.map((strategy) => (
                <article className="strategy-card" key={strategy.title}>
                  <div className={`strategy-cover ${strategy.style}`}>
                    <div className="cover-topline"><span className="cover-category">{strategy.category}</span><span className="cover-menu">•••</span></div>
                    <span className="cover-symbol" aria-hidden="true">{strategy.symbol}</span>
                    <span className="cover-tag">COMMUNITY IDEA</span>
                    <div className="cover-orbit orbit-one" /><div className="cover-orbit orbit-two" />
                  </div>
                  <div className="strategy-content">
                    <div className="strategy-title-row"><h3>{strategy.title}</h3><button className="save-button" type="button" aria-label={`Save ${strategy.title}`}>♡</button></div>
                    <p>{strategy.description}</p>
                    <div className="strategy-meta"><span>{strategy.market}</span><span className="sample-label">EXAMPLE</span></div>
                    <div className="strategy-footer"><span className="creator-avatar">{strategy.initials}</span><span>by <strong>{strategy.creator}</strong></span><span className="strategy-arrow"><ArrowIcon /></span></div>
                  </div>
                </article>
              ))}
            </div>
            <p className="demo-note">ตัวอย่างหน้าตาและชื่อกลยุทธ์สำหรับการออกแบบ ยังไม่ใช่ผลการเทรดจริง</p>
          </div>
        </section>

        <section className="section-shell flow-section" id="community">
          <div className="flow-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> FROM IDEA TO COMMUNITY</div>
            <h2>Build. Test.<br /><span>Run. Share.</span></h2>
            <p>พื้นที่เดียวที่ให้ไอเดียของคุณเดินทางต่อได้ ตั้งแต่เริ่มวางแผน ทดลองบน MT5 ไปจนถึงแบ่งปันให้คนอื่นได้เรียนรู้</p>
            <Link href="/build" className="button button-dark">เริ่มจากไอเดียของคุณ <ArrowIcon /></Link>
          </div>
          <div className="flow-visual">
            <div className="flow-rail" aria-hidden="true"><span /><span /><span /><span /></div>
            <article className="flow-card flow-card-build"><span className="flow-icon">✳</span><div><span className="flow-step-label">01 · MAKE IT YOURS</span><h3>Build</h3><p>วางแผนด้วยคำถามที่เข้าใจง่าย</p></div><span className="flow-check">✓</span></article>
            <article className="flow-card flow-card-test"><span className="flow-icon">⌁</span><div><span className="flow-step-label">02 · SEE HOW IT FELT</span><h3>Test</h3><p>ลองทดสอบบน MetaTrader 5</p></div><span className="flow-check">↗</span></article>
            <article className="flow-card flow-card-run"><span className="flow-icon">↗</span><div><span className="flow-step-label">03 · WHEN YOU ARE READY</span><h3>Run</h3><p>เลือกวิธีใช้งานที่เหมาะกับคุณ</p></div><span className="flow-check">→</span></article>
            <article className="flow-card flow-card-share"><span className="flow-icon">♡</span><div><span className="flow-step-label">04 · GROW TOGETHER</span><h3>Share</h3><p>แบ่งปันกติกาและสิ่งที่เรียนรู้</p></div><span className="flow-check">✳</span></article>
          </div>
        </section>

        <section className="performance-section" id="performance">
          <div className="section-shell performance-layout">
            <div className="performance-copy">
              <div className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> TRUST, WITH CONTEXT</div>
              <h2>Verified<br /><span>Performance</span></h2>
              <p>ตัวเลขที่เห็นควรมีที่มา เราออกแบบให้ข้อมูลผลทดสอบมาพร้อมช่วงเวลา แหล่งข้อมูล และบริบท เพื่อช่วยให้คุณประเมินได้รอบด้าน</p>
              <Link href="#performance-details" className="performance-link">รู้จักผลทดสอบที่ตรวจสอบได้ <ArrowIcon /></Link>
            </div>
            <article className="verification-card" id="performance-details">
              <div className="verification-top"><span className="verification-badge"><span>✓</span> PERFORMANCE PREVIEW</span><span className="verification-dots">•••</span></div>
              <div className="verification-title"><div><span className="mini-label">TEST REPORT · EXAMPLE VIEW</span><h3>Strategy performance</h3></div><span className="verify-check">✓</span></div>
              <div className="verification-chart"><div className="chart-grid-lines"><i /><i /><i /><i /></div><svg viewBox="0 0 500 160" preserveAspectRatio="none" role="img" aria-label="ตัวอย่างกราฟผลทดสอบ"><path d="M0 127C38 130 50 108 82 115S129 134 158 100 202 82 224 90 257 63 286 72 324 49 351 58 389 32 418 42 460 20 500 19" fill="none" stroke="#42C9BF" strokeWidth="4" strokeLinecap="round" /><path d="M0 127C38 130 50 108 82 115S129 134 158 100 202 82 224 90 257 63 286 72 324 49 351 58 389 32 418 42 460 20 500 19V160H0Z" fill="url(#performanceFill)" /><defs><linearGradient id="performanceFill" x1="250" y1="15" x2="250" y2="160" gradientUnits="userSpaceOnUse"><stop stopColor="#42C9BF" stopOpacity=".24"/><stop offset="1" stopColor="#42C9BF" stopOpacity="0"/></linearGradient></defs></svg></div>
              <div className="verification-source"><span className="source-check">✓</span><span>Source and test period shown with each report</span><span className="source-arrow">↗</span></div>
              <div className="verification-disclaimer">A verified label means the report source is checked. It does not guarantee future results.</div>
            </article>
          </div>
        </section>

        <section className="section-shell creators-section" id="creators">
          <div className="creator-intro">
            <div className="eyebrow"><span className="eyebrow-dot" /> PEOPLE MAKE THE ROOM</div>
            <h2>Top Creators<br /><span>& Community</span></h2>
            <p>ทุกคนเริ่มจากการเรียนรู้ มารู้จักผู้สร้าง แบ่งปันประสบการณ์ และเติบโตไปด้วยกัน</p>
            <Link href="#join-community" className="text-link">สำรวจชุมชน <ArrowIcon /></Link>
          </div>
          <div className="creator-list">
            <div className="creator-list-heading"><span>CREATOR SPOTLIGHT</span><span className="spotlight-note">ตัวอย่างโปรไฟล์</span></div>
            {creators.map((creator, index) => (
              <article className="creator-row" key={creator.name}>
                <span className="creator-rank">0{index + 1}</span>
                <span className={`creator-photo ${creator.tone}`}>{creator.initials}</span>
                <div className="creator-info"><h3>{creator.name}<span className="creator-spark">✳</span></h3><p>{creator.note}</p></div>
                <Link href="#join-community" className="creator-follow">View profile <ArrowIcon /></Link>
              </article>
            ))}
            <div className="creator-list-footer"><span>GOOD IDEAS TRAVEL FURTHER</span><span className="footer-doodle">↗</span></div>
          </div>
        </section>

        <section className="section-shell pricing-section" id="pricing">
          <div className="pricing-ornament" aria-hidden="true">✳</div>
          <div className="eyebrow"><span className="eyebrow-dot" /> YOUR NEXT STEP</div>
          <h2>มีไอเดียอยู่แล้วใช่ไหม?</h2>
          <p>เริ่มสร้าง Strategy ฟรี แล้วค่อย ๆ เรียนรู้ไปพร้อมชุมชน</p>
          <div className="pricing-actions"><Link href="/build" className="button button-primary">สร้าง Strategy ฟรี <ArrowIcon /></Link><Link href="#trending" className="button button-secondary">ดู Strategy ยอดนิยม</Link></div>
          <span className="pricing-footnote">ชัดเจน เรียนรู้ได้ และเป็นสไตล์ของคุณ</span>
        </section>
      </main>

      <footer className="site-footer" id="join-community">
        <div className="section-shell footer-main">
          <div className="footer-brand-block"><Link href="#top" className="brand"><BrandMark /><span className="brand-name">EASpaze<span className="brand-period">.</span></span></Link><p>A friendly home for trading ideas<br />and strategies that grow together.</p></div>
          <div className="footer-links"><div><span>EXPLORE</span><Link href="#trending">Strategies</Link><Link href="#creators">Creators</Link></div><div><span>CREATE</span><Link href="/build">Strategy Builder</Link><Link href="#performance">Backtest</Link></div><div><span>EA ROOOM</span><Link href="#community">Our community</Link><Link href="#pricing">Get started</Link></div></div>
        </div>
        <div className="section-shell footer-bottom"><span>© 2026 EASpaze. Built for curious minds.</span><span>Trading involves risk. Learn, test, and choose carefully.</span></div>
      </footer>
    </>
  );
}

import type { Metadata } from 'next';
import { Button, ConfidenceMark, Eyebrow, HelpStrip, NotStated, SectionLabel, TopBar } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Style guide | Next Door',
};

const COLORS = [
  { name: 'yellow', hex: '#FACC0A', cls: 'bg-yellow', job: 'Act: the one primary button, help strip, plan card head. Navy text only on it.' },
  { name: 'navy', hex: '#122640', cls: 'bg-navy', job: 'All text, top bar, safety screens, selected states.' },
  { name: 'indigo', hex: '#1A2187', cls: 'bg-indigo', job: 'Medicine route only.' },
  { name: 'sand', hex: '#EDE5DE', cls: 'bg-sand', job: 'The person’s own words, “what to say”, resting blocks.' },
  { name: 'white', hex: '#FFFFFF', cls: 'bg-white', job: 'Ground.' },
  { name: 'charcoal', hex: '#33373D', cls: 'bg-charcoal', job: 'Secondary text, never for anything that matters.' },
];

const TYPE = [
  { name: 'Question · Playfair 700', phone: '28 px', desktop: '40–42 px', easy: '34 px' },
  { name: 'Body · Archivo 400', phone: '17–18 px', desktop: '18–20 px', easy: '22 px' },
  { name: 'Phone number · Archivo 700', phone: '26 px', desktop: '28 px', easy: '32 px' },
  { name: 'Labels · Archivo 600', phone: '12 px caps', desktop: '13 px caps', easy: '17 px bold, sentence case' },
  { name: 'Primary button', phone: '58 px tall', desktop: '64 px tall', easy: '68 px tall' },
];

export default function StyleguidePage() {
  return (
    <>
      <HelpStrip />
      <TopBar label="Next Door · style guide" />

      <main className="mx-auto max-w-content space-y-12 px-gutter py-10">
        <header className="space-y-3">
          <Eyebrow>IHH design system in code</Eyebrow>
          <h1 className="m-0 text-[44px] leading-[1.15]">Calm, not clinical.</h1>
          <p className="m-0 max-w-text text-[17px]">
            Every token and component on this page comes from <code>src/app/globals.css</code> and{' '}
            <code>src/components/ui</code>. The rules are in <code>design/HANDOFF.md</code>. Square corners, no shadows, no
            gradients, one yellow button per screen.
          </p>
        </header>

        <section className="space-y-4">
          <SectionLabel>Color · one job each</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COLORS.map(c => (
              <div key={c.name} className="border-2 border-navy">
                <div className={`h-20 ${c.cls} ${c.name === 'white' ? 'border-b-2 border-navy' : ''}`} />
                <div className="space-y-1 p-3 text-[14px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <b>{c.name}</b>
                    <code className="text-[13px]">{c.hex}</code>
                  </div>
                  <div className="text-[13px]">
                    <code>{c.cls}</code>
                  </div>
                  <p className="m-0 leading-snug">{c.job}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <SectionLabel>Type</SectionLabel>
          <p className="question m-0">What do you need most right now?</p>
          <p className="m-0 max-w-text text-[18px]">A place to sleep. It is for adults from Santa Ana. It may fit you. It is not a promise.</p>
          <p className="phone-number m-0">(800) 364-2221</p>
          <Eyebrow>Label · sentence in caps</Eyebrow>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b-2 border-navy">
                  <th className="py-2 pr-4">Text</th>
                  <th className="py-2 pr-4">Phone</th>
                  <th className="py-2 pr-4">Desktop</th>
                  <th className="py-2">Make it easier</th>
                </tr>
              </thead>
              <tbody>
                {TYPE.map(t => (
                  <tr key={t.name} className="border-b border-navy">
                    <td className="py-2 pr-4 font-semibold">{t.name}</td>
                    <td className="py-2 pr-4">{t.phone}</td>
                    <td className="py-2 pr-4">{t.desktop}</td>
                    <td className="py-2">{t.easy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <SectionLabel>Buttons · one primary per screen</SectionLabel>
          <div className="flex flex-wrap items-center gap-4">
            <Button arrow>Approve plan</Button>
            <Button variant="secondary">Review plan</Button>
            <Button variant="link">Swap the door</Button>
            <Button disabled>Mark safe</Button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm" variant="secondary">
              Small · 44
            </Button>
            <Button>Default · 58</Button>
            <Button size="lg">Desktop · 64</Button>
            <Button size="xl" arrow>
              Make it easier · 68
            </Button>
          </div>
          <div className="on-dark flex flex-wrap items-center gap-4 bg-dark p-6">
            <Button arrow>On navy, no border</Button>
            <Button variant="secondary">Secondary on navy</Button>
            <Button variant="link">Link on navy</Button>
          </div>
          <pre className="panel-soft m-0 overflow-x-auto p-4 text-[13px]">{`import { Button } from '@/components/ui';

<Button arrow onClick={approve}>Approve plan</Button>
<Button variant="secondary" href="/review">Review plan</Button>
<Button size="xl" block>Next</Button>`}</pre>
        </section>

        <section className="space-y-4">
          <SectionLabel>Confidence marks · shape, not color</SectionLabel>
          <div className="flex flex-wrap gap-6">
            <ConfidenceMark level="high" checkedOn="October 13" />
            <ConfidenceMark level="medium" />
            <ConfidenceMark level="low" />
          </div>
          <p className="m-0 text-[15px]">
            Hours: <NotStated />
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="tag">Tag</span>
            <span className="tag tag-accent">5 days left</span>
            <span className="tag tag-dark">Safety</span>
            <span className="tag tag-medicine">Ask the nurse</span>
          </div>
        </section>

        <section className="space-y-4">
          <SectionLabel>Plan card head</SectionLabel>
          <div className="max-w-[390px] border-2 border-navy">
            <div className="space-y-1 bg-accent p-5 text-on-accent">
              <Eyebrow>Your next door</Eyebrow>
              <h3 className="m-0 text-[28px] leading-tight">Yale Navigation Center</h3>
              <ConfidenceMark level="high" checkedOn="October 13" />
            </div>
            <div className="panel-soft p-5">
              <Eyebrow>What to say</Eyebrow>
              <p className="m-0 mt-1 text-[17px] leading-relaxed">Hi, my name is Ray. I leave Illumination on Friday. I need a place to sleep. I use a walker.</p>
            </div>
            <div className="p-5">
              <Button block arrow>
                Keep it
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <SectionLabel>Never</SectionLabel>
          <p className="m-0 text-[15px]">
            Rounded corners, shadows, gradients, yellow text on white, white text on yellow, emoji, Tailwind’s default palette
            (slate, blue, emerald) for anything that ships.
          </p>
        </section>
      </main>
    </>
  );
}

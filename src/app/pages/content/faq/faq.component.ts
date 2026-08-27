import { Component, OnInit, inject } from '@angular/core';
import { KcAccordionComponent } from '@kaspacom/ui-kit';
import { ContentLayoutComponent } from '../content-layout/content-layout.component';
import { SeoService } from '../../../services/seo.service';
import contentRoutes from '../content-routes.json';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Is the KaspaCom wallet self-custodial?',
    answer:
      "Yes. KaspaCom Wallet is a non-custodial (self-custody) wallet: your private keys and seed phrase are generated and encrypted on your own device, and KaspaCom never has access to them or to your funds. You are the only one who can authorize a transaction.",
  },
  {
    question: 'Where is my seed phrase stored?',
    answer:
      "Your seed phrase never leaves your device. It's encrypted locally with the password you set and stored in your browser. KaspaCom's servers never see your seed phrase, your private keys, or your password.",
  },
  {
    question: 'What happens if I lose my seed phrase?',
    answer:
      "If you lose your seed phrase and also lose access to the device/browser where your wallet is stored, there is no way to recover your funds — not even KaspaCom can do it, because we never hold a copy of your keys. Always back up your seed phrase somewhere safe and offline when you create a wallet.",
  },
  {
    question: 'Does KaspaCom ever have access to my funds or password?',
    answer:
      'No. Because the wallet is self-custodial, all signing happens locally in your browser. KaspaCom cannot move your funds, reset your password, or recover your account on your behalf.',
  },
  {
    question: 'What assets can I store and manage in the wallet?',
    answer:
      'The wallet supports native Kaspa (KAS), KRC-20 fungible tokens, KRC-721 NFTs, and KNS (Kaspa Name Service) domains, all from a single interface.',
  },
  {
    question: 'Are there fees to send Kaspa?',
    answer:
      "Sending KAS requires a small network fee paid to Kaspa miners, the same as any proof-of-work blockchain — the wallet does not add its own fee on top of standard transfers. Fee amounts depend on current network conditions and are shown before you confirm a transaction.",
  },
  {
    question: 'Which browsers does the wallet support?',
    answer:
      'KaspaCom Wallet runs as a browser-based application and works on modern, up-to-date desktop browsers. If your browser is not compatible, the app will let you know rather than fail silently.',
  },
  {
    question: 'Can I connect the wallet to dApps?',
    answer:
      'Yes. The wallet supports connecting to Kaspa dApps so they can request transaction approvals, which you review and sign yourself before anything is sent.',
  },
  {
    question: 'Is Kaspa the same as Bitcoin?',
    answer:
      "No, though they're both proof-of-work cryptocurrencies. Bitcoin uses a single-chain Nakamoto consensus, while Kaspa uses the GHOSTDAG protocol on a BlockDAG, allowing many blocks to be produced and confirmed per second instead of one every ~10 minutes. See our Kaspa vs Bitcoin guide for details.",
  },
  {
    question: 'How fast are Kaspa transactions?',
    answer:
      "Kaspa's BlockDAG architecture is built for fast block production — following the 2025 Crescendo network upgrade, Kaspa produces 10 blocks per second, giving transactions practical confirmation times far quicker than traditional single-chain proof-of-work coins.",
  },
  {
    question: 'What is a KNS domain, and do I need one?',
    answer:
      "A KNS (Kaspa Name Service) domain lets you use a human-readable name instead of a long Kaspa address. It's optional, but it reduces the risk of copy-paste mistakes when sending or receiving funds. See our KNS guide to learn more.",
  },
];

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [ContentLayoutComponent, KcAccordionComponent],
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.scss'],
})
export class FaqComponent implements OnInit {
  private readonly seo = inject(SeoService);

  readonly faqItems = FAQ_ITEMS;

  ngOnInit(): void {
    const page = contentRoutes.pages.find((p) => p.path === '/faq')!;
    this.seo.setPage({
      title: page.title,
      description: page.description,
      path: page.path,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ_ITEMS.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    });
  }
}

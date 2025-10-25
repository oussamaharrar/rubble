import { ENV } from './env';

export interface MiniAppManifest {
  version: string;
  schema: string;
  accountAssociation: {
    header: string;
    payload: string;
    signature: string;
  };
  baseBuilder: {
    ownerAddress: string;
  };
  miniapp: {
    id: string;
    name: string;
    description: string;
    homepageUrl: string;
    playableUrl: string;
    iconUrl: string;
    splashImageUrl: string;
    splashBackgroundColor: string;
    developer: {
      name: string;
      url: string;
    };
    tags: string[];
    categories: string[];
    requestedPermissions: string[];
    webhookUrl: string;
    gallery: Array<{
      type: string;
      url: string;
      description: string;
    }>;
    links: {
      assets: string;
    };
    basePay: {
      payToAddress: string;
      minPriceWei: string;
    };
  };
}

export function buildMiniAppManifest(): MiniAppManifest {
  const baseUrl = ENV.NEXT_PUBLIC_URL.replace(/\/$/, '');

  return {
    version: '1.0.0',
    schema: 'https://schemas.farcaster.xyz/2024-10-01/miniapp',
    accountAssociation: {
      header: ENV.FARCASTER_ACCOUNT_HEADER,
      payload: ENV.FARCASTER_ACCOUNT_PAYLOAD,
      signature: ENV.FARCASTER_ACCOUNT_SIGNATURE,
    },
    baseBuilder: {
      ownerAddress: ENV.BASE_BUILDER_OWNER_ADDRESS,
    },
    miniapp: {
      id: 'rubble-bubble-hunt',
      name: 'Rubble (Bubble Hunt)',
      description: 'Tap bubbles, rack combos, and trigger Base Pay boosters to slow time.',
      homepageUrl: baseUrl,
      playableUrl: `${baseUrl}/`,
      iconUrl: `${baseUrl}/game-icons/icon.png`,
      splashImageUrl: `${baseUrl}/game-icons/splash.png`,
      splashBackgroundColor: '#04060B',
      developer: {
        name: 'Rubble Labs',
        url: baseUrl,
      },
      tags: ['game', 'arcade', 'base', 'booster'],
      categories: ['game'],
      requestedPermissions: ['pay', 'wallet'],
      webhookUrl: ENV.NEXT_PUBLIC_WEBHOOK_URL,
      gallery: [
        {
          type: 'image/png',
          url: `${baseUrl}/game-icons/og.png`,
          description: 'High score chain combos during slow-motion mode.',
        },
      ],
      links: {
        assets: `${baseUrl}/game-icons/`,
      },
      basePay: {
        payToAddress: ENV.PAY_TO_ADDRESS,
        minPriceWei: ENV.MIN_PRICE_WEI.toString(),
      },
    },
  };
}

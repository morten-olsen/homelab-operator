const GROUP = 'homelab.mortenolsen.pro';
const API_VERSION = `${GROUP}/v1`;

const FIELDS = {
  domain: {
    domainId: `${GROUP}/domain-id`,
  },
};

const CONTROLLED_LABEL = {
  [`${GROUP}/controlled`]: 'true',
};

const CONTROLLED_LABEL_SELECTOR = `${GROUP}/controlled=true`;

export { GROUP, FIELDS, CONTROLLED_LABEL, CONTROLLED_LABEL_SELECTOR, API_VERSION };

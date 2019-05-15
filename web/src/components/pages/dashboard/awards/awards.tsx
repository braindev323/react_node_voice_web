import * as React from 'react';
import { useEffect } from 'react';
import { connect } from 'react-redux';
import { UserClient } from 'common/user-clients';
import API from '../../../../services/api';
import StateTree from '../../../../stores/tree';
import { User } from '../../../../stores/user';
import URLS from '../../../../urls';
import { MicIcon, PlayOutlineIcon } from '../../../ui/icons';
import { LinkButton } from '../../../ui/ui';

import './awards.css';

const NoAwardsPage = () => (
  <div className="no-awards-page">
    <img src={require('./stars.svg')} alt="Stars" />
    <h1>Earn your first award, create a goal</h1>
    <LinkButton rounded to={URLS.GOALS}>
      Get started with goals
    </LinkButton>
    <p>When you complete a personal goal, your awards will show up here.</p>
  </div>
);

const INTERVAL_LABELS: { [key: number]: string } = {
  1: 'Daily',
  7: 'Weekly',
};

const Wave = () => (
  <svg className="wave" width="172" height="70" viewBox="0 0 172 70">
    <defs>
      <linearGradient id="wave-b" x1="50%" x2="50%" y1="100%" y2="0%">
        <stop offset="0%" stopColor="#040101" stopOpacity="0" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.3" />
      </linearGradient>
      <path
        id="wave-a"
        d="M0 49.237c22.655-18.809 30.755-2.594 58.986-2.594C89.25 46.643 100.896 10 128 10c21 0 26 9 44 16.117V80H0V49.237z"
      />
    </defs>
    <use
      fill="url(#wave-b)"
      fillRule="evenodd"
      opacity=".5"
      transform="matrix(-1 0 0 1 172 -10)"
      xlinkHref="#wave-a"
    />
  </svg>
);

const AwardBox = ({ award }: any) => (
  <li className={'award-box ' + award.type}>
    <Wave />
    <div className="interval">
      {INTERVAL_LABELS[award.days_interval] || award.days_interval}
    </div>
    <div className="line" />
    <div className="amount">{award.amount} Clips</div>
    <div className="type">
      {award.type[0].toUpperCase() + award.type.slice(1)}
    </div>
    <div className="icon">
      {({ speak: <MicIcon />, listen: <PlayOutlineIcon /> } as any)[award.type]}
    </div>
  </li>
);

interface PropsFromState {
  account: UserClient;
  api: API;
}

interface PropsFromDispatch {
  refreshUser: typeof User.actions.refresh;
}

type Props = PropsFromState & PropsFromDispatch;

function AwardsPage({ account, api, refreshUser }: Props) {
  useEffect(() => {
    api.seenAwards().then(() => {
      refreshUser();
    });
  }, []);

  const { awards } = account;

  if (awards.length == 0) {
    return <NoAwardsPage />;
  }

  const buckets = awards.reduce((buckets, award) => {
    const bucket = buckets[award.days_interval];
    buckets[award.days_interval] = bucket ? [...bucket, award] : [award];
    return buckets;
  }, []);

  return (
    <div className="award-lists">
      {buckets.map((bucket: any[], i: number) =>
        bucket ? (
          <>
            <h2>{INTERVAL_LABELS[i] || i}</h2>
            <ul>
              {bucket.map((award, i) => (
                <AwardBox key={i} award={award} />
              ))}
            </ul>
          </>
        ) : null
      )}
    </div>
  );
}

export default connect<PropsFromState, PropsFromDispatch>(
  ({ api, user }: StateTree) => ({
    account: user.account,
    api,
  }),
  { refreshUser: User.actions.refresh }
)(AwardsPage);

export type JobOnAPI = {
  appearDate: string;
  applyCnt: number;
  coIndustry: number;
  coIndustryDesc: string;
  custName: string;
  custNo: string;
  description: string;
  descSnippet: string;
  mrtDist: number;
  jobAddress: string;
  jobAddrNo: number;
  jobAddrNoDesc: string;
  jobName: string;
  jobNameSnippet: string;
  jobNo: string;
  jobRo: number;
  jobType: number;
  lat: number;
  lon: number;
  link: {
    job: string;
    cust: string;
    applyAnalyze: string;
  };
  major: [];
  mrt: string;
  mrtDesc: string;
  optionEdu: number[];
  period: number;
  remoteWorkType: number;
  s10: number;
  salaryHigh: number;
  salaryLow: number;
  tags: {
    wf7: {
      desc: string;
      param: string;
    };
    wf30: {
      desc: string;
      param: string;
    };
    wf29: {
      desc: string;
      param: string;
    };
    wf10: {
      desc: string;
      param: string;
    };
    wf3: {
      desc: string;
      param: string;
    };
    wf1: {
      desc: string;
      param: string;
    };
    wf4: {
      desc: string;
      param: string;
    };
    wf9: {
      desc: string;
      param: string;
    };
    landmark: {
      desc: string;
    };
  };
  s9: number[];
  s5: number;
  d3: string;
  hrBehaviorPR: number;
  jobCat: number[];
  labels: string[];
  languageRequirements: [];
  acceptRole: number[];
  employeeCount: number;
  pcSkills: [
    {
      code: string;
      description: string;
    },
    {
      code: string;
      description: string;
    },
    {
      code: string;
      description: string;
    },
    {
      code: string;
      description: string;
    },
    {
      code: string;
      description: string;
    },
    {
      code: string;
      description: string;
    },
    {
      code: string;
      description: string;
    },
    {
      code: string;
      description: string;
    },
    {
      code: string;
      description: string;
    },
  ];
  pddScore: number;
  isSave: null;
  interactionRecord: {
    lastProcessedResumeAtTime: number;
    lastCustReplyTimestamp: null;
    nowTimestamp: number;
  };
  isApplied: null;
  applyDate: null;
  userApplyCount: null;
};

export type JobsAPIResponse = {
  data: JobOnAPI[];
  metadata: {
    pagination: {
      count: number;
      currentPage: number;
      lastPage: number;
      total: number;
    };
    isPreciseHotJob: boolean;
    filterQuery: {
      order: number;
      asc: number;
      excludeKwFz: number;
      excludeKwKwop: number;
      s5: number;
      searchTempExclude: number;
      enableJobNoTopOrder: number;
      area: string[];
      wktm: string[];
      s9: string[];
      jobcat: string[];
      ro: string[];
      scstrict: number;
      scneg: number;
      page: number;
      pagesize: number;
    };
    personalBoost: number;
  };
};

export type JobDetailOnHTML = {
  description: string;
  salary: string;
  location: string;
};

import { JobDetailOnHTML } from './@types';

export const waitFordDetailPageSelector =
  '.job-description__content';

export function extractJobDetailOnHTML(): JobDetailOnHTML {
  const descriptionElement = document.querySelector(
    '.job-description__content',
  );
  const description = descriptionElement
    ? descriptionElement.innerHTML
        .replace(/ +/g, ' ')
        .replace(/\t+/g, '  ')
        .trim()
    : '';

  let requirement = '';
  const requirementElements = document.querySelectorAll(
    '.job-requirement .job-requirement-table__data p',
  );

  if (requirementElements.length > 0) {
    const parts = [];
    for (let i = 0; i < requirementElements.length; i++) {
      const cleaned = requirementElements[i]
        ? requirementElements[i].innerHTML
            .replace(/ +/g, ' ')
            .replace(/\t+/g, '  ')
            .trim()
        : '';
      if (cleaned) {
        parts.push(cleaned);
      }
    }
    requirement = parts.join('\n');
  } else {
    const requirementContainer = document.querySelector(
      '.job-requirement',
    );
    requirement = requirementContainer
      ? requirementContainer.innerHTML
          .replace(/ +/g, ' ')
          .replace(/\t+/g, '  ')
          .trim()
      : '';
  }

  const titleElement =
    document.querySelector('hgroup > h1');
  const title = titleElement
    ? (titleElement.textContent?.trim() ?? '')
    : '';

  let salary = '',
    tools = '';

  document.querySelectorAll('.list-row').forEach(el => {
    if (el.textContent?.startsWith('工作待遇')) {
      salary = el.textContent
        .trim()
        .replace(/工作待遇\s?/, '')
        .trimEnd();
      if (salary.includes('面議')) {
        salary = '面議';
      } else {
        const result =
          /(月|年)薪.*?元(以上)?/.exec(salary) ?? [];
        if (result && result[0]) {
          salary = result[0];
        }
      }
    } else if (el.textContent?.startsWith('擅長工具')) {
      tools = el.textContent
        .trim()
        .replace(/擅長工具\s?/, '')
        .trimEnd();
    }
  });

  return {
    description: [description, requirement, tools].join(
      '\n',
    ),
    salary,
  };
}

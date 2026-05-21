import { JobDetailOnHTML } from './@types';

export const waitFordDetailPageSelector =
  '[class^=ContentSection-module-scss-module__][class$=__content]';

export function extractJobDetailOnHTML(): JobDetailOnHTML {
  const descriptionElements = document.querySelectorAll(
    '[class^=ContentSection-module-scss-module__][class$=__content]',
  );
  const description = [...descriptionElements]
    .map(x => x.innerHTML)
    .join('\n')
    .replace(/ +/g, ' ')
    .replace(/\t+/g, '  ')
    .trim();

  const salaryElem = document.querySelector(
    '[class^=JobDescriptionRightColumn-module-scss-module__][class$=__salaryWrapper]',
  );
  const salary = salaryElem
    ? (salaryElem.textContent?.trim() ?? '')
    : '';

  const companyInfoItem = document.querySelector(
    '[class^=CompanyInfoItem-module-scss-module__][class$=__container]',
  );
  const company_type = companyInfoItem
    ? (companyInfoItem.textContent?.trim() ?? '')
    : '';

  return {
    description,
    salary,
    company_type,
  };
}

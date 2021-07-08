getTeamMembers('rvyas');

function storedFetch(url) {
  const val = localStorage.getItem(url);
  if (val) {
    return Promise.resolve(new Response(new Blob([val]), {
      headers: {
        'x-pages': Number(localStorage.getItem('x-pages'))
      }
    }));
  } else {
    return fetch(url).then(resp => {
      resp.clone().text().then(text => {
        localStorage.setItem(url, text);
      });
      return resp;
    });
  }
}

function getPeoplePage(page) {
  return storedFetch(`https://my.sqcorp.co/people/api/all.json?page=${page}`);
}

function getPeople() {
  let pages = 1;

  const fetch1 = getPeoplePage(pages);
  const fetches = [fetch1.then(resp => resp.json())];

  return fetch1.then(resp => {
    pages = resp.headers.get('x-pages');
    localStorage.setItem('x-pages', pages);

    while(fetches.length < pages) {
      fetches.push(getPeoplePage(fetches.length + 1).then(resp => resp.json()));
    }

    return Promise.all(fetches).then(resps => [].concat(...resps));
  });
}

function getTeamMembers(leadUsername) {
    getPeople().then(people => {

        personByUsername = people.reduce((map, person) => {
            map[person.username] = person;
            return map;
        }, {}
        );

        people.forEach((person) => {
            let leadPerson = personByUsername[person.lead];
            if (leadPerson) {
                leadPerson.reports ||= [];
                leadPerson.reports.push(person);
                person.leadPerson = leadPerson;
            }
        }
        );

        let leadPerson = personByUsername[leadUsername];

        // Collect all leads and ics.
        let stack = [leadPerson];
        let ics = [];
        let ems = [];

        while (stack.length) {
            person = stack.pop();
            if (person.reports) {
                stack.push(...person.reports);
                ems.push(person);
            }
            else {
                ics.push(person);
            }
        }
        if(ems.length) {
            console.log(`EMs under ${leadUsername} are ${ems.map(p => p.username)}`)
        }
        if(ics.length) {
            console.log(`ICs under ${leadUsername} are ${ics.map(p => p.username)}`)
        }
    })
}

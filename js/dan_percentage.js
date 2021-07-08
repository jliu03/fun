searchFor('danston');

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

function isOnTeam(person, team) {
  return person.organization === team.name;
}

function tryTeam(person, team) {
  if (isOnTeam(person, team)) {
    if (!team.people) { team.people = []; }
    // this doesn't really represent how people are also members of parent groups
    team.people.push(person);
    person.team = team;
    return team;
  } else {
    for (let child of team.children) {
      // side effect, link parents
      if (!child.parent) {
        child.parent = team;
      }

      const found = tryTeam(person, child);
      if (found) {
        return found;
      }
    }
  }
}

function getAllPeopleOnTeam(team) {
  return team.children.reduce((people, child) => {
    return people.concat(getAllPeopleOnTeam(child));
  }, team.people || []);
}

function getPercentOfTeam(team, person) {
  const people = getAllPeopleOnTeam(team);
  people.sort((a, b) => a.index - b.index);
  console.log('sorted', people);
  return [people.indexOf(person), people.length];
}

function walkUpTree(team, callback) {
  callback(team);
  if (team.parent) {
    walkUpTree(team.parent, callback);
  }
}

function timeAgo(date) {
  const diffDays = Math.floor(((new Date().getTime()) - date.getTime()) / 1000 / 60 / 60 / 24);

  const yearRemainder = diffDays % 365;

  return [
    [Math.floor(diffDays / 365), 'years'],
    [Math.floor(yearRemainder / 30), 'months'],
    [yearRemainder % 30, 'days']
  ].filter(([n]) => n > 0).flat();
}

function searchFor(search) {
  return Promise.all([
    storedFetch('https://my.sqcorp.co/people/api/teams.json').then(resp => resp.json()),
    getPeople()
  ]).then(([teams, people]) => {
    const realTeams = teams.find(team => team.reference_id === 'Square Team');
    realTeams.children = teams.filter(team => team.reference_id !== 'Square Team');

    console.log(realTeams, people);

    let searchPerson;

    const teamlessPeople = new Set();

    people.forEach((person, i) => {
      person.index = i + 1;

      if (person.organization) {
        tryTeam(person, realTeams);
      } else {
        teamlessPeople.add(person);
      }

      if (search === person.username) {
        searchPerson = person;
      }
    });

    // search for this person's boss and put them on that team? this makes them a peer of the boss
    for (let person of people) {
      for (let teamlessPerson of teamlessPeople) {
        if (teamlessPerson.lead === person.username) {
          teamlessPerson.team = person.team;
          person.team.people.push(teamlessPerson);
        }
      }
    }

    console.log(searchPerson, searchPerson.team, teamlessPeople);
    console.log('people', people);

    walkUpTree(searchPerson.team, team => {
      const [index, total] = getPercentOfTeam(team, searchPerson);
      const percent = `(${(index / total * 100).toFixed(2)}% joined before)`;
      console.log(searchPerson.username, 'is', index + 1, 'of', total, 'on', team.name, percent);
    });

    const startDate = new Date(searchPerson.start_date);

    console.log(searchPerson.username, 'started on', searchPerson.start_date, 'roughly', ...timeAgo(startDate), 'ago.');
    const photo = searchPerson.authoritative_photo || searchPerson.primary_photo;
    open(photo, '_blank', 'left=10,top=10,width=400,height=600,status=off,menubar=off,toolbar=off,location=off');
  });
}

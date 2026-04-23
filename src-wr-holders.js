
let platform = 'pc';
let subcategories = [];
let remainingCategories = [];
let totalCategories = 0;

async function getJson(url) {
    url = url.replace('http://','https://');
    return fetch(url).then(res => res.json());
}

// main process

getJson('https://www.speedrun.com/api/v1/games/j1n5e91p/categories')
    .then(json => json.data)
    .then(categories => 
        categories.map(category => Object.assign(category, {isCategoryExtension: false}))
    )
    .then(addCategories);

getJson('https://www.speedrun.com/api/v1/games/4d7np7l6/categories')
    .then(json => json.data)
    .then(categories => 
        categories.map(category => Object.assign(category, {isCategoryExtension: true}))
    )
    .then(addCategories);

function addCategories(categories) {
    remainingCategories.push(...categories);
    totalCategories += categories.length;
    for (let i=0; i<categories.length; i++) {
        const category = categories[i];
        category.index = i;
        const variablesLink = category.links.find(link => link.rel === 'variables').uri;
        getJson(variablesLink)
            .then(json => json.data)
            .then(variables => variables.filter(variable => variable['is-subcategory']))
            .then(addSubcategories.bind(null, i, category));
    }
}

// recursive method for counting all subcategories of all categories

function addSubcategories(finalIndex, category, variables, variableIds, variableNames, variableIndex, variableSortingIndices) {
    variableIds ??= {};
    variableNames ??= {};
    variableIndex ??= 0;
    variableSortingIndices ??= [];
    
    const variable = variables[variableIndex];
    const values = variable.values.values;
    const valueKeys = Object.keys(values);

    const tempVariableIds = Object.assign({},variableIds);
    const tempVariableNames = Object.assign({},variableNames);
    const tempVariableSortingIndices = Array.from(variableSortingIndices);

    let varCount = 1;
    for (let i=0; i<variables.length; i++) {
        varCount *= Object.keys(variables[i].values.values).length;
    }
    category.curCount ??= 0;

    valueKeys.forEach((key, keyIndex) => {
        tempVariableIds[variable.id] = key;
        tempVariableNames[variable.name] = values[key].label;
        tempVariableSortingIndices[variableIndex] = keyIndex;

        const thisIterationVariableIds = Object.assign({}, tempVariableIds);
        const thisIterationVariableNames = Object.assign({}, tempVariableNames);
        const thisIterationVariableSortingIndices = Array.from(tempVariableSortingIndices);
        
        if (variableIndex >= variables.length - 1) {
            let linkVars = '';
            const variableIdKeys = Object.keys(tempVariableIds);
            variableIdKeys.forEach(idKey => {
                linkVars += `&var-${idKey}=${tempVariableIds[idKey]}`;
            });
            let leaderboardLink = category.links.find(link => link.rel === 'leaderboard').uri;
            leaderboardLink += `?top=1${linkVars}`;
            getJson(leaderboardLink)
                .then(json => json.data.runs)
                .then(runs => {
                    const isEmpty = runs.length === 0;
                    const wrHolderObjs = [];
                    runs.forEach(run => {
                        getJson(run.run.players[0].uri)
                            .then(player => {
                                wrHolderObjs.push(player);
                                if (wrHolderObjs.length === runs.length) {
                                    wrHolderObjs.sort(
                                        (a,b) =>
                                            runs.indexOf(run => run.run.players[0].id === a.data.id) -
                                            runs.indexOf(run => run.run.players[0].id === b.data.id)
                                        );
                                    pushSubcategory(category, finalIndex, thisIterationVariableSortingIndices, thisIterationVariableIds, thisIterationVariableNames, wrHolderObjs, runs, varCount);
                                }
                            });
                    });
                    if (runs.length === 0) {
                        pushSubcategory(category, finalIndex, thisIterationVariableSortingIndices, thisIterationVariableIds, thisIterationVariableNames, wrHolderObjs, runs, varCount);
                    }
                });
        }
        else addSubcategories(finalIndex, category, variables, tempVariableIds, tempVariableNames, variableIndex + 1, tempVariableSortingIndices);
    });
}

function pushSubcategory(category, index, secondaryIndices, variableIds, variableNames, wrHolders, runs, varCount) {
    subcategories.push({
        name: category.name,
        id: category.id,
        index: index,
        secondaryIndices: secondaryIndices,
        variableIds: variableIds,
        variableNames: variableNames,
        isCategoryExtension: category.isCategoryExtension,
        wrHolders: wrHolders,
        wrRuns: runs
    });
    category.curCount++;
    if (category.curCount === varCount) {
        remainingCategories.splice(remainingCategories.indexOf(category), 1);
        document.getElementById('percent').innerText = Math.floor(100*(1-remainingCategories.length/totalCategories));
    }
    if (remainingCategories.length === 0) {
        setTable();
    }
}

function setTable() {
    // filter for platform
    platformSubcategories = subcategories.filter(x => x.variableNames[Object.keys(x.variableNames).filter(y => y.substring(0,8) === 'Platform')[0]].toLowerCase() === platform.toLowerCase());

    platformSubcategories.sort((a, b) => {
        if (a.isCategoryExtension !== b.isCategoryExtension) return a.isCategoryExtension ? 1 : -1;
        if (a.index !== b.index) return a.index - b.index;
        for (let i=0; i<a.secondaryIndices.length; i++) {
            if (a.secondaryIndices[i] !== b.secondaryIndices[i]) {
                return a.secondaryIndices[i] - b.secondaryIndices[i];
            }
        }
        return 0;
    });

    // html stuff
    document.getElementById('info')?.remove();

    const mainDiv = document.getElementById('main');
    mainDiv.innerHTML = '';
    
    // set table

    const table = document.createElement('table');
    table.innerHTML = '';

    const headingTr = document.createElement('tr');
    ['category','wr holder','time','link'].forEach(x => {
        const th = document.createElement('th');
        th.innerHTML = x;
        headingTr.append(th);
    });
    table.append(headingTr);

    for (let i=0; i<platformSubcategories.length; i++) {
        const subcategory = platformSubcategories[i];
        const tr = document.createElement('tr');
        const cells = [];
        const numCells = 4;

        for (let i=0; i<numCells; i++) {
            cells[i] = document.createElement('td');
        }
        
        let nameText = subcategory.name;
        nameText += ' ('
        const variableKeys = Object.keys(subcategory.variableNames);
        for (let j=0; j<variableKeys.length; j++) {
            nameText += subcategory.variableNames[variableKeys[j]] + (j === variableKeys.length-1 ? ')' : ', ');
        }
        cells[0].classList.add(subcategory.isCategoryExtension ? 'category-extension' : 'base-category');
        cells[0].innerHTML = `<span class="category">${nameText}</span>`;

        cells[1].innerHTML = '';
        cells[3].innerHTML = '';
        for (let i=0; i<subcategory.wrHolders.length; i++) {
            const wrHolder = subcategory.wrHolders[i];
            const wrRun = subcategory.wrRuns[i].run;
            const nameStyle = wrHolder.data['name-style'];
            if (nameStyle.style === 'gradient') {
                cells[1].innerHTML += `<a class="username" style="background-image: linear-gradient(0.25turn,${nameStyle['color-from'].light},${nameStyle['color-to'].light});" href="${wrHolder.data.weblink}">${wrHolder.data.names.international}</a>`;
            }
            else {
                console.log(`NON GRADIENT NAME STYLE: ${nameStyle.style}`);
                cells[1].innerHTML += `<a class="username" style="background: #000" href="${wrHolder.data.weblink}">${wrHolder.data.names.international}</a>`;
            }
            if (i < subcategory.wrHolders.length-1) cells[1].innerHTML += ', ';
            
            cells[3].innerHTML += `<a href="${wrRun.weblink}">${wrRun.weblink}</a>`;
            if (i < subcategory.wrHolders.length-1) cells[3].innerHTML += ', ';
        }
        if (cells[1].innerHTML === '') {
            cells[1].innerHTML = '(empty)';
            cells[3].innerHTML = '-';
        }
        cells[2].innerHTML = formatTime(subcategory.wrRuns[0]?.run?.times?.primary_t ?? '-');

        for (let i=0; i<numCells; i++) {
            tr.append(cells[i]);
        }
        
        table.append(tr);
    }
    
    const button = document.createElement('button');
    button.innerHTML = 'switch platform';
    button.onclick = switchPlatform;
    
    mainDiv.append(button);
    mainDiv.append(table);
}

function switchPlatform() {
    platform = platform === 'pc' ? 'console' : 'pc';
    setTable();
}

function formatTime(seconds) {
    if (typeof seconds === 'string') return seconds;
    let hr = Math.floor(seconds/3600);
    seconds -= 3600*hr;
    let min = Math.floor(seconds/60);
    seconds -= 60*min;
    min = `${min}`.padStart(2,'0');
    if (seconds % 1 !== 0) seconds = seconds.toFixed(3).padStart(6,'0');
    else seconds = `${seconds}`.padStart(2,'0');
    if (hr) return `${hr}:${min}:${seconds}`;
    return `${min}:${seconds}`;
}

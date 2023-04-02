module.exports= {
  find_best: (new_employee, potential_matches) => {
    new_employee.age = new_employee.age * -1;
    console.log(potential_matches.length);
    score = [];
    for(i = 0; i < potential_matches.length; i++)
        score[i] = 0;

    comm_score = [2, 1, 21, 1, 8, 3, 3, 13, 13, 5];
    conf_score = [8, 2, 3, 1, 5];

    w = "";
    NewEmp_techStack = new Set();
    new_employee.tech_stack.split(',').forEach(element => {
     NewEmp_techStack.add(element); 
    });

    for(i = 0; i < potential_matches.length; i++)
    {
        //score[i] = 0 - 1000 * Math.max(0, potential_matches[i].buddy_num - 2);
        
      /*if(potential_matches[i].id == null ||
      potential_matches[i].age == null ||
      potential_matches[i].industry == null ||
      potential_matches[i].front_or_backend == null ||
      potential_matches[i].tech_stack == null ||
      potential_matches[i].language_familiarity == null ||
      potential_matches[i].tools_familiarity == null ||
      potential_matches[i].communication_stlye == null ||
      potential_matches[i].conflict_style == null ||
      potential_matches[i].communication_skills == null ||
      potential_matches[i].teamwork_skills == null
      ){
        score[i] = -99999;
        continue;
      }*/

        potential_matches[i].age = potential_matches[i].age * -1;  
        score[i] += 10 * (potential_matches[i].age);

        score[i] += 100 * (new_employee.industry === potential_matches[i].industry);

        score[i] -= 1000 * Math.abs(new_employee.front_or_backend - potential_matches[i].front_or_backend);

        potential_matches[i].tech_stack.split(',').forEach(element => {
         if(NewEmp_techStack.has(element)) {
           score[i] += 1000;
        } 
        });
      

        for(j = 0; j < 10; j++)
            score[i] += 100 * Math.max(0, Number(potential_matches[i].language_familiarity[j]) - Number(new_employee.language_familiarity[j]));

        for(j = 0; j < 10; j++)
            score[i] += 100 * Math.max(0, Number(potential_matches[i].tools_familiarity[j]) - Number(new_employee.tools_familiarity[j]));

        score[i] += 10 * comm_score[potential_matches[i].communication_style];

        score[i] += 10 * conf_score[potential_matches[i].conflict_style];

        for(j = 0; j < 3; j++)
            score[i] += 100 * Math.max(0, Number(potential_matches[i].communication_skills[j]) - Number(new_employee.communication_skills[j]));

        for(j = 0; j < 3; j++)
            score[i] += 100 * Math.max(0, Number(potential_matches[i].teamwork_skills[j]) - Number(new_employee.teamwork_skills[j]));

    }
    matches = new Set();
    max_score = -2000000000;

    for(i = 0; i < potential_matches.length; i++)
    {
        if(score[i] >= max_score)
        {
            if(score[i] > max_score)
            {
                matches.clear();
                max_score = score[i];
            }
            matches.add(potential_matches[i].id);
        }
    }

    let scoreS = "";

    score.forEach(el => {
      scoreS += String(el) + " "; 
    })

    console.log(scoreS)

    return Array.from(matches);
  }
}

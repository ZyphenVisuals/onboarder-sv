module.exports= {
  find_best: (new_employee, potential_matches) => {
    new_employee.age = new_employee.age * -1;
    console.log(potential_matches.length)
    score = [];
    for(i = 0; i < potential_matches.length; i++)
        score[i] = 0;

    comm_score = [2, 1, 21, 1, 8, 3, 3, 13, 13, 5];
    conf_score = [8, 2, 3, 1, 5];

    w = "";
    NewEmp_techStack = new Set();
    for(i = 0; i < new_employee.tech_stack.length; i++)
    {
        if(new_employee.tech_stack[i] == ' ')
        {
            NewEmp_techStack.add(w);
            w = "";
        }
        else w += new_employee.tech_stack[i];
    }
    NewEmp_techStack.add(w);

    for(i = 0; i < potential_matches.length; i++)
    {
        //score[i] = 0 - 1000 * Math.max(0, potential_matches[i].buddy_num - 2);
        
      if(potential_matches[0].id == null ||
      potential_matches[0].age == null ||
      potential_matches[0].industry == null ||
      potential_matches[0].front_or_backend == null ||
      potential_matches[0].tech_stack == null ||
      potential_matches[0].language_familiarity == null ||
      potential_matches[0].tools_familiarity == null ||
      potential_matches[0].communication_stlye == null ||
      potential_matches[0].conflict_style == null ||
      potential_matches[0].communication_skills == null ||
      potential_matches[0].teamwork_skills == null
      ){
        score[i] = -99999;
        continue;
      }

        potential_matches[i].age = potential_matches[i].age * -1;  

        score[i] += 10 * (potential_matches[i].age - 2 * new_employee.age);

        score[i] += 100 * (new_employee.industry === potential_matches[i].industry);

        score[i] -= 1000 * Math.abs(new_employee.front_or_backend - potential_matches[i].front_or_backend);

        w = "";
        for(j = 0; j < potential_matches[i].tech_stack.length; j++)
        {
            if(potential_matches[i].tech_stack[j] == ' ')
            {
                if(NewEmp_techStack.has(w))
                    score[i] += 1000;
                w = "";
            }
            else w += potential_matches[i].tech_stack[j];
        }
        if(NewEmp_techStack.has(w))
            score[i] += 100;

        for(j = 0; j < 10; j++)
            score += 100 * Math.max(0, Number(potential_matches[i].language_familiarity[j]) - Number(new_employee.language_familiarity[j]));

        for(j = 0; j < 10; j++)
            score += 100 * Math.max(0, Number(potential_matches[i].tools_familiarity[j]) - Number(new_employee.tools_familiarity[j]));

        score[i] += 10 * comm_score[potential_matches[i].communication_stlye];

        score[i] += 10 * conf_score[potential_matches[i].conflict_style];

        for(j = 0; j < 3; j++)
            score[i] += 100 * Math.max(0, Number(potential_matches[i].communication_skills[j]) - Number(new_employee.communication_skills[j]));

        for(j = 0; j < 3; j++)
            score[i] += 100 * Math.max(0, Number(potential_matches[i].teamwork_skills[j]) - Number(new_employee.teamwork_skills[j]));

        console.log("final score", i, score[i]);
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

    return Array.from(matches).length;
  }
}

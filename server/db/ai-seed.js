// Exactly 50 explicitly labeled, inactive profiles. No API calls or simulated replies.
export async function seedAiCounselors(client) {
  const counts={Healthcare:7,Education:5,Engineering:4,Technology:5,Business:6,Agriculture:5,Law:3,Media:2,Arts:2,'Social Services':3,Trades:3,Transportation:1,Language:1,Tourism:2,Sports:1};
  for(const [category,count] of Object.entries(counts)) {
    const careers=(await client.query('SELECT id,title FROM careers WHERE category=$1 ORDER BY id',[category])).rows;
    for(let index=0;index<count;index++) {
      const slug=`ai-${category.toLowerCase().replace(/\s+/g,'-')}-${index+1}`;
      if((await client.query('SELECT user_id FROM ai_counselor_profiles WHERE slug=$1',[slug])).rowCount) continue;
      const mapped=careers.filter((_,i)=>i%count===index);
      const specialty=mapped.map(c=>c.title).join(', ');
      const user=(await client.query("INSERT INTO users(first_name,last_name,phone,password,role,is_approved,counselor_type,industry_specialty,bio) VALUES($1,$2,$3,'!','counselor',0,'ai',$4,$5) RETURNING id",['AI Counselor',`${category} ${index+1}`,slug,specialty,'Clearly identified AI career-guidance profile. Not a human counselor. Inactive until the administrator configures and activates a model provider.'])).rows[0];
      await client.query('INSERT INTO ai_counselor_profiles(user_id,slug,specialty,system_prompt) VALUES($1,$2,$3,$4)',[user.id,slug,specialty,`You are a clearly identified AI career-guidance assistant for CareerScope students in Liberia, specializing in ${specialty}. Never claim to be human. Give age-appropriate, practical educational guidance. Do not invent admissions requirements or guarantees. Encourage verification and consultation with an assigned human counselor. Do not provide medical, legal, emergency or financial professional advice. Protect student privacy.`]);
      for(const career of mapped) await client.query('INSERT INTO counselor_career_paths(counselor_id,career_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[user.id,career.id]);
    }
  }
}

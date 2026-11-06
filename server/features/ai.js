import express from 'express';
import { query } from '../db/postgres.js';
import { authenticate,requireRole } from '../middleware/pg-auth.js';
import { fail,numericId } from '../services/notifications.js';

const router=express.Router();
router.use(authenticate);
router.get('/',async(req,res)=>{
  const counselors=(await query("SELECT p.user_id,p.slug,p.specialty,p.is_enabled,u.first_name || ' ' || u.last_name AS name,u.counselor_level,COALESCE(json_agg(json_build_object('id',c.id,'title',c.title)) FILTER(WHERE c.id IS NOT NULL),'[]') AS careers FROM ai_counselor_profiles p JOIN users u ON u.id=p.user_id LEFT JOIN counselor_career_paths m ON m.counselor_id=p.user_id LEFT JOIN careers c ON c.id=m.career_id GROUP BY p.user_id,u.id ORDER BY p.slug")).rows;
  res.json({counselors,providerConfigured:false,activationMode:'configure-later',message:'AI conversations are inactive. These are AI profiles, not human counselors. Provider integration and explicit activation are required before any paid model calls.'});
});
router.patch('/:id',requireRole('admin'),async(req,res)=>{
  if(req.body.isEnabled) throw fail(409,'Live AI activation is not enabled in configure-later mode. Configure and validate the provider integration before activation.');
  if(!(await query('UPDATE ai_counselor_profiles SET is_enabled=false WHERE user_id=$1',[numericId(req.params.id)])).rowCount) throw fail(404,'AI profile not found');
  res.json({enabled:false});
});
router.post('/:id/messages',async(req,res)=>{throw fail(503,'AI conversations are inactive. Contact your assigned human counselor. No model request or charge was made.');});
export default router;


export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "broadcasts": {
                  Row: {
                    "classroom_id": string,"id": string,"sent_at": string,"session_id": string | null,"target": string,"target_value": string | null,"teacher_id": string,"text": string
                  }
                  Insert: {
                    "classroom_id": string,"id"?: string,"sent_at"?: string,"session_id"?: string | null,"target"?: string,"target_value"?: string | null,"teacher_id": string,"text": string
                  }
                  Update: {
                    "classroom_id"?: string,"id"?: string,"sent_at"?: string,"session_id"?: string | null,"target"?: string,"target_value"?: string | null,"teacher_id"?: string,"text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "broadcasts_classroom_id_fkey"
      columns: ["classroom_id"]
isOneToOne: false
      referencedRelation: "classrooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "broadcasts_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "class_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "broadcasts_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    }
                  ]
                },"buddy_offers": {
                  Row: {
                    "attempt_no": number,"expires_at": string,"helper_id": string,"id": string,"match_score": number | null,"request_id": string,"responded_at": string | null,"sent_at": string,"status": string
                  }
                  Insert: {
                    "attempt_no": number,"expires_at": string,"helper_id": string,"id"?: string,"match_score"?: number | null,"request_id": string,"responded_at"?: string | null,"sent_at"?: string,"status"?: string
                  }
                  Update: {
                    "attempt_no"?: number,"expires_at"?: string,"helper_id"?: string,"id"?: string,"match_score"?: number | null,"request_id"?: string,"responded_at"?: string | null,"sent_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "buddy_offers_helper_id_fkey"
      columns: ["helper_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "buddy_offers_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "buddy_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"buddy_requests": {
                  Row: {
                    "accepted_at": string | null,"attempts": number,"classroom_id": string,"created_at": string,"done_at": string | null,"feedback": string | null,"helper_id": string | null,"id": string,"kind": string,"mission_id": string,"requester_id": string,"requester_passed_after": boolean | null,"resolved_at": string | null,"status": string
                  }
                  Insert: {
                    "accepted_at"?: string | null,"attempts"?: number,"classroom_id": string,"created_at"?: string,"done_at"?: string | null,"feedback"?: string | null,"helper_id"?: string | null,"id"?: string,"kind"?: string,"mission_id": string,"requester_id": string,"requester_passed_after"?: boolean | null,"resolved_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"attempts"?: number,"classroom_id"?: string,"created_at"?: string,"done_at"?: string | null,"feedback"?: string | null,"helper_id"?: string | null,"id"?: string,"kind"?: string,"mission_id"?: string,"requester_id"?: string,"requester_passed_after"?: boolean | null,"resolved_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "buddy_requests_classroom_id_fkey"
      columns: ["classroom_id"]
isOneToOne: false
      referencedRelation: "classrooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "buddy_requests_helper_id_fkey"
      columns: ["helper_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "buddy_requests_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"chat_messages": {
                  Row: {
                    "created_at": string,"id": string,"role": string,"source": string,"student_id": string,"text": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"role": string,"source"?: string,"student_id": string,"text": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"role"?: string,"source"?: string,"student_id"?: string,"text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_messages_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"class_sessions": {
                  Row: {
                    "ai_enabled": boolean,"allow_early_boss": boolean,"allow_skip_missions": boolean,"class_minutes": number,"classroom_id": string,"created_at": string,"ended_at": string | null,"focus_screen": boolean,"focus_screen_at": string | null,"home_deadline": string | null,"id": string,"phase": string,"phase_changed_by": string | null,"phase_minutes": NonNullable<Json>,"phase_minutes_custom": boolean,"phase_started_at": string,"posttest_closed_at": string | null,"posttest_enabled": boolean,"posttest_opened_at": string | null,"pretest_closed_at": string | null,"pretest_enabled": boolean,"pretest_opened_at": string | null,"previous_phase": string | null,"previous_phase_at": string | null,"showcase_enabled": boolean,"started_at": string,"survey_enabled": boolean,"timer_end_at": string | null,"timer_extended_seconds": number,"timer_paused_seconds": number | null,"updated_at": string
                  }
                  Insert: {
                    "ai_enabled"?: boolean,"allow_early_boss"?: boolean,"allow_skip_missions"?: boolean,"class_minutes"?: number,"classroom_id": string,"created_at"?: string,"ended_at"?: string | null,"focus_screen"?: boolean,"focus_screen_at"?: string | null,"home_deadline"?: string | null,"id"?: string,"phase"?: string,"phase_changed_by"?: string | null,"phase_minutes"?: NonNullable<Json>,"phase_minutes_custom"?: boolean,"phase_started_at"?: string,"posttest_closed_at"?: string | null,"posttest_enabled"?: boolean,"posttest_opened_at"?: string | null,"pretest_closed_at"?: string | null,"pretest_enabled"?: boolean,"pretest_opened_at"?: string | null,"previous_phase"?: string | null,"previous_phase_at"?: string | null,"showcase_enabled"?: boolean,"started_at"?: string,"survey_enabled"?: boolean,"timer_end_at"?: string | null,"timer_extended_seconds"?: number,"timer_paused_seconds"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "ai_enabled"?: boolean,"allow_early_boss"?: boolean,"allow_skip_missions"?: boolean,"class_minutes"?: number,"classroom_id"?: string,"created_at"?: string,"ended_at"?: string | null,"focus_screen"?: boolean,"focus_screen_at"?: string | null,"home_deadline"?: string | null,"id"?: string,"phase"?: string,"phase_changed_by"?: string | null,"phase_minutes"?: NonNullable<Json>,"phase_minutes_custom"?: boolean,"phase_started_at"?: string,"posttest_closed_at"?: string | null,"posttest_enabled"?: boolean,"posttest_opened_at"?: string | null,"pretest_closed_at"?: string | null,"pretest_enabled"?: boolean,"pretest_opened_at"?: string | null,"previous_phase"?: string | null,"previous_phase_at"?: string | null,"showcase_enabled"?: boolean,"started_at"?: string,"survey_enabled"?: boolean,"timer_end_at"?: string | null,"timer_extended_seconds"?: number,"timer_paused_seconds"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_sessions_classroom_id_fkey"
      columns: ["classroom_id"]
isOneToOne: false
      referencedRelation: "classrooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_sessions_phase_changed_by_fkey"
      columns: ["phase_changed_by"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    }
                  ]
                },"classroom_mission_settings": {
                  Row: {
                    "classroom_id": string,"mission_id": string,"settings": NonNullable<Json>,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "classroom_id": string,"mission_id": string,"settings"?: NonNullable<Json>,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "classroom_id"?: string,"mission_id"?: string,"settings"?: NonNullable<Json>,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "classroom_mission_settings_classroom_id_fkey"
      columns: ["classroom_id"]
isOneToOne: false
      referencedRelation: "classrooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "classroom_mission_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    }
                  ]
                },"classrooms": {
                  Row: {
                    "closes_at": string | null,"created_at": string,"id": string,"is_demo": boolean,"opens_at": string,"room_code": string,"status": string,"teacher_id": string
                  }
                  Insert: {
                    "closes_at"?: string | null,"created_at"?: string,"id"?: string,"is_demo"?: boolean,"opens_at"?: string,"room_code": string,"status"?: string,"teacher_id": string
                  }
                  Update: {
                    "closes_at"?: string | null,"created_at"?: string,"id"?: string,"is_demo"?: boolean,"opens_at"?: string,"room_code"?: string,"status"?: string,"teacher_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "classrooms_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    }
                  ]
                },"content_flags": {
                  Row: {
                    "categories": (string)[],"classroom_id": string,"context": string,"created_at": string,"id": string,"level": number,"masked_text": string | null,"original_text": string,"resolved_at": string | null,"resolved_by": string | null,"student_id": string | null,"teacher_note": string | null
                  }
                  Insert: {
                    "categories"?: (string)[],"classroom_id": string,"context": string,"created_at"?: string,"id"?: string,"level": number,"masked_text"?: string | null,"original_text": string,"resolved_at"?: string | null,"resolved_by"?: string | null,"student_id"?: string | null,"teacher_note"?: string | null
                  }
                  Update: {
                    "categories"?: (string)[],"classroom_id"?: string,"context"?: string,"created_at"?: string,"id"?: string,"level"?: number,"masked_text"?: string | null,"original_text"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"student_id"?: string | null,"teacher_note"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_flags_classroom_id_fkey"
      columns: ["classroom_id"]
isOneToOne: false
      referencedRelation: "classrooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "content_flags_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "content_flags_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "created_at": string,"id": string,"payload": NonNullable<Json>,"student_id": string,"type": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"student_id": string,"type": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"student_id"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"grade_jobs": {
                  Row: {
                    "ai_result": Json | null,"attempts": number,"created_at": string,"error": string | null,"id": string,"input": NonNullable<Json>,"status": string,"student_id": string,"submission_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "ai_result"?: Json | null,"attempts"?: number,"created_at"?: string,"error"?: string | null,"id"?: string,"input"?: NonNullable<Json>,"status"?: string,"student_id": string,"submission_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "ai_result"?: Json | null,"attempts"?: number,"created_at"?: string,"error"?: string | null,"id"?: string,"input"?: NonNullable<Json>,"status"?: string,"student_id"?: string,"submission_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "grade_jobs_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "grade_jobs_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"mission_progress": {
                  Row: {
                    "attempts": number,"channel_used": string | null,"forced_pass_at": string | null,"forced_pass_by": string | null,"hints_used": number,"id": string,"level_override": number | null,"mission_id": string,"passed_at": string | null,"skip_allowed": boolean | null,"skipped_by": string | null,"stars": number,"started_at": string | null,"student_id": string,"updated_at": string
                  }
                  Insert: {
                    "attempts"?: number,"channel_used"?: string | null,"forced_pass_at"?: string | null,"forced_pass_by"?: string | null,"hints_used"?: number,"id"?: string,"level_override"?: number | null,"mission_id": string,"passed_at"?: string | null,"skip_allowed"?: boolean | null,"skipped_by"?: string | null,"stars"?: number,"started_at"?: string | null,"student_id": string,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"channel_used"?: string | null,"forced_pass_at"?: string | null,"forced_pass_by"?: string | null,"hints_used"?: number,"id"?: string,"level_override"?: number | null,"mission_id"?: string,"passed_at"?: string | null,"skip_allowed"?: boolean | null,"skipped_by"?: string | null,"stars"?: number,"started_at"?: string | null,"student_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mission_progress_forced_pass_by_fkey"
      columns: ["forced_pass_by"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mission_progress_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"mission_skips": {
                  Row: {
                    "id": string,"mission_id": string,"reason": string | null,"skipped_at": string,"student_id": string
                  }
                  Insert: {
                    "id"?: string,"mission_id": string,"reason"?: string | null,"skipped_at"?: string,"student_id": string
                  }
                  Update: {
                    "id"?: string,"mission_id"?: string,"reason"?: string | null,"skipped_at"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mission_skips_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"peer_feedback": {
                  Row: {
                    "created_at": string,"from_student_id": string,"hidden_at": string | null,"hidden_by": string | null,"hidden_reason": string | null,"id": string,"praise_text": string,"suggest_text": string,"to_student_id": string
                  }
                  Insert: {
                    "created_at"?: string,"from_student_id": string,"hidden_at"?: string | null,"hidden_by"?: string | null,"hidden_reason"?: string | null,"id"?: string,"praise_text"?: string,"suggest_text"?: string,"to_student_id": string
                  }
                  Update: {
                    "created_at"?: string,"from_student_id"?: string,"hidden_at"?: string | null,"hidden_by"?: string | null,"hidden_reason"?: string | null,"id"?: string,"praise_text"?: string,"suggest_text"?: string,"to_student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "peer_feedback_from_student_id_fkey"
      columns: ["from_student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "peer_feedback_hidden_by_fkey"
      columns: ["hidden_by"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "peer_feedback_to_student_id_fkey"
      columns: ["to_student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_requests": {
                  Row: {
                    "classroom_id": string,"created_at": string,"granted_value": string | null,"id": string,"kind": string,"mission_id": string | null,"reason": string,"requested_value": string | null,"responded_at": string | null,"responded_by": string | null,"status": string,"student_id": string,"teacher_response": string | null
                  }
                  Insert: {
                    "classroom_id": string,"created_at"?: string,"granted_value"?: string | null,"id"?: string,"kind": string,"mission_id"?: string | null,"reason": string,"requested_value"?: string | null,"responded_at"?: string | null,"responded_by"?: string | null,"status"?: string,"student_id": string,"teacher_response"?: string | null
                  }
                  Update: {
                    "classroom_id"?: string,"created_at"?: string,"granted_value"?: string | null,"id"?: string,"kind"?: string,"mission_id"?: string | null,"reason"?: string,"requested_value"?: string | null,"responded_at"?: string | null,"responded_by"?: string | null,"status"?: string,"student_id"?: string,"teacher_response"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_requests_classroom_id_fkey"
      columns: ["classroom_id"]
isOneToOne: false
      referencedRelation: "classrooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_requests_responded_by_fkey"
      columns: ["responded_by"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_requests_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "audience": string | null,"boss_template_id": string | null,"business_edit_unlocked": boolean,"business_name": string | null,"business_type": string | null,"certificate_display_name": string | null,"channel_chosen_by": string | null,"channel_suggested": string | null,"channel_switches": number,"confidence": NonNullable<Json>,"domain_name": string | null,"earned_stars": number,"goal_id": string | null,"goal_raised_at": string | null,"goal_raised_count": number,"goal_stars": number | null,"hints_toggled_by": string | null,"is_registered_company": boolean | null,"learning_route": string | null,"level_by_objective": NonNullable<Json>,"level_overridden_by_student": NonNullable<Json>,"level_suggested": number | null,"own_goal_text": string | null,"post_test_score": number | null,"pre_test_score": number | null,"readiness": NonNullable<Json>,"scaffold_level": number,"self_goal_level": number | null,"student_id": string,"talent_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "audience"?: string | null,"boss_template_id"?: string | null,"business_edit_unlocked"?: boolean,"business_name"?: string | null,"business_type"?: string | null,"certificate_display_name"?: string | null,"channel_chosen_by"?: string | null,"channel_suggested"?: string | null,"channel_switches"?: number,"confidence"?: NonNullable<Json>,"domain_name"?: string | null,"earned_stars"?: number,"goal_id"?: string | null,"goal_raised_at"?: string | null,"goal_raised_count"?: number,"goal_stars"?: number | null,"hints_toggled_by"?: string | null,"is_registered_company"?: boolean | null,"learning_route"?: string | null,"level_by_objective"?: NonNullable<Json>,"level_overridden_by_student"?: NonNullable<Json>,"level_suggested"?: number | null,"own_goal_text"?: string | null,"post_test_score"?: number | null,"pre_test_score"?: number | null,"readiness"?: NonNullable<Json>,"scaffold_level"?: number,"self_goal_level"?: number | null,"student_id": string,"talent_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "audience"?: string | null,"boss_template_id"?: string | null,"business_edit_unlocked"?: boolean,"business_name"?: string | null,"business_type"?: string | null,"certificate_display_name"?: string | null,"channel_chosen_by"?: string | null,"channel_suggested"?: string | null,"channel_switches"?: number,"confidence"?: NonNullable<Json>,"domain_name"?: string | null,"earned_stars"?: number,"goal_id"?: string | null,"goal_raised_at"?: string | null,"goal_raised_count"?: number,"goal_stars"?: number | null,"hints_toggled_by"?: string | null,"is_registered_company"?: boolean | null,"learning_route"?: string | null,"level_by_objective"?: NonNullable<Json>,"level_overridden_by_student"?: NonNullable<Json>,"level_suggested"?: number | null,"own_goal_text"?: string | null,"post_test_score"?: number | null,"pre_test_score"?: number | null,"readiness"?: NonNullable<Json>,"scaffold_level"?: number,"self_goal_level"?: number | null,"student_id"?: string,"talent_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_student_id_fkey"
      columns: ["student_id"]
isOneToOne: true
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"progress": {
                  Row: {
                    "attempts": number,"completed_at": string | null,"hints_used": number,"id": string,"started_at": string | null,"station": string,"status": string,"student_id": string
                  }
                  Insert: {
                    "attempts"?: number,"completed_at"?: string | null,"hints_used"?: number,"id"?: string,"started_at"?: string | null,"station": string,"status"?: string,"student_id": string
                  }
                  Update: {
                    "attempts"?: number,"completed_at"?: string | null,"hints_used"?: number,"id"?: string,"started_at"?: string | null,"station"?: string,"status"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "progress_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_item_responses": {
                  Row: {
                    "answered_at": string,"choice_index": number | null,"classroom_id": string,"id": string,"is_correct": boolean,"item_id": string,"quiz_set": string,"student_id": string
                  }
                  Insert: {
                    "answered_at"?: string,"choice_index"?: number | null,"classroom_id": string,"id"?: string,"is_correct": boolean,"item_id": string,"quiz_set": string,"student_id": string
                  }
                  Update: {
                    "answered_at"?: string,"choice_index"?: number | null,"classroom_id"?: string,"id"?: string,"is_correct"?: boolean,"item_id"?: string,"quiz_set"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_item_responses_classroom_id_fkey"
      columns: ["classroom_id"]
isOneToOne: false
      referencedRelation: "classrooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_item_responses_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"reflections": {
                  Row: {
                    "answer_text": string,"created_at": string,"id": string,"question_id": string,"student_id": string
                  }
                  Insert: {
                    "answer_text"?: string,"created_at"?: string,"id"?: string,"question_id": string,"student_id": string
                  }
                  Update: {
                    "answer_text"?: string,"created_at"?: string,"id"?: string,"question_id"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reflections_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"route_changes": {
                  Row: {
                    "changed_at": string,"changed_by": string,"from_route": string | null,"id": string,"mission_id": string | null,"student_id": string,"to_route": string
                  }
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string,"from_route"?: string | null,"id"?: string,"mission_id"?: string | null,"student_id": string,"to_route": string
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string,"from_route"?: string | null,"id"?: string,"mission_id"?: string | null,"student_id"?: string,"to_route"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "route_changes_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"session_phase_changes": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"from_phase": string | null,"id": string,"session_id": string,"to_phase": string,"undone_at": string | null
                  }
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"from_phase"?: string | null,"id"?: string,"session_id": string,"to_phase": string,"undone_at"?: string | null
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"from_phase"?: string | null,"id"?: string,"session_id"?: string,"to_phase"?: string,"undone_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_phase_changes_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_phase_changes_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "class_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"showcase_likes": {
                  Row: {
                    "created_at": string,"from_student_id": string,"to_student_id": string
                  }
                  Insert: {
                    "created_at"?: string,"from_student_id": string,"to_student_id": string
                  }
                  Update: {
                    "created_at"?: string,"from_student_id"?: string,"to_student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "showcase_likes_from_student_id_fkey"
      columns: ["from_student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "showcase_likes_to_student_id_fkey"
      columns: ["to_student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"story_jobs": {
                  Row: {
                    "attempts": number,"created_at": string,"error": string | null,"id": string,"input": NonNullable<Json>,"result": Json | null,"status": string,"student_id": string,"updated_at": string
                  }
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"error"?: string | null,"id"?: string,"input"?: NonNullable<Json>,"result"?: Json | null,"status"?: string,"student_id": string,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"error"?: string | null,"id"?: string,"input"?: NonNullable<Json>,"result"?: Json | null,"status"?: string,"student_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "story_jobs_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"student_phase_unlocks": {
                  Row: {
                    "granted_at": string,"granted_by": string | null,"id": string,"note": string | null,"phase": string,"revoked_at": string | null,"student_id": string
                  }
                  Insert: {
                    "granted_at"?: string,"granted_by"?: string | null,"id"?: string,"note"?: string | null,"phase": string,"revoked_at"?: string | null,"student_id": string
                  }
                  Update: {
                    "granted_at"?: string,"granted_by"?: string | null,"id"?: string,"note"?: string | null,"phase"?: string,"revoked_at"?: string | null,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_phase_unlocks_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_phase_unlocks_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"students": {
                  Row: {
                    "accepts_buddy_requests": boolean,"buddy_helped_count": number,"classroom_id": string,"created_at": string,"current_screen": string | null,"device_token": string | null,"id": string,"last_seen_at": string | null,"must_change_pin": boolean,"nickname": string,"pin_hash": string,"pin_reset_at": string | null,"pin_reset_by": string | null
                  }
                  Insert: {
                    "accepts_buddy_requests"?: boolean,"buddy_helped_count"?: number,"classroom_id": string,"created_at"?: string,"current_screen"?: string | null,"device_token"?: string | null,"id"?: string,"last_seen_at"?: string | null,"must_change_pin"?: boolean,"nickname": string,"pin_hash": string,"pin_reset_at"?: string | null,"pin_reset_by"?: string | null
                  }
                  Update: {
                    "accepts_buddy_requests"?: boolean,"buddy_helped_count"?: number,"classroom_id"?: string,"created_at"?: string,"current_screen"?: string | null,"device_token"?: string | null,"id"?: string,"last_seen_at"?: string | null,"must_change_pin"?: boolean,"nickname"?: string,"pin_hash"?: string,"pin_reset_at"?: string | null,"pin_reset_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "students_classroom_id_fkey"
      columns: ["classroom_id"]
isOneToOne: false
      referencedRelation: "classrooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "students_pin_reset_by_fkey"
      columns: ["pin_reset_by"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    }
                  ]
                },"submissions": {
                  Row: {
                    "ai_scores": Json | null,"ai_scores_snapshot": Json | null,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string,"domain_name": string,"emphasis_changed_count": number,"emphasis_criterion": string | null,"format": string,"id": string,"needs_review": boolean,"peer_visible": boolean | null,"pin_hide_name": boolean,"pinned_at": string | null,"pinned_by": string | null,"reason_text": string | null,"self_scores": Json | null,"student_id": string,"teacher_changed": boolean | null,"teacher_confirmed_scores": Json | null,"teacher_scores_before": Json | null,"tld": string,"updated_at": string
                  }
                  Insert: {
                    "ai_scores"?: Json | null,"ai_scores_snapshot"?: Json | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"domain_name": string,"emphasis_changed_count"?: number,"emphasis_criterion"?: string | null,"format"?: string,"id"?: string,"needs_review"?: boolean,"peer_visible"?: boolean | null,"pin_hide_name"?: boolean,"pinned_at"?: string | null,"pinned_by"?: string | null,"reason_text"?: string | null,"self_scores"?: Json | null,"student_id": string,"teacher_changed"?: boolean | null,"teacher_confirmed_scores"?: Json | null,"teacher_scores_before"?: Json | null,"tld": string,"updated_at"?: string
                  }
                  Update: {
                    "ai_scores"?: Json | null,"ai_scores_snapshot"?: Json | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"domain_name"?: string,"emphasis_changed_count"?: number,"emphasis_criterion"?: string | null,"format"?: string,"id"?: string,"needs_review"?: boolean,"peer_visible"?: boolean | null,"pin_hide_name"?: boolean,"pinned_at"?: string | null,"pinned_by"?: string | null,"reason_text"?: string | null,"self_scores"?: Json | null,"student_id"?: string,"teacher_changed"?: boolean | null,"teacher_confirmed_scores"?: Json | null,"teacher_scores_before"?: Json | null,"tld"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "submissions_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submissions_pinned_by_fkey"
      columns: ["pinned_by"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submissions_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"survey_completions": {
                  Row: {
                    "completed_at": string,"session_id": string | null,"student_id": string
                  }
                  Insert: {
                    "completed_at"?: string,"session_id"?: string | null,"student_id": string
                  }
                  Update: {
                    "completed_at"?: string,"session_id"?: string | null,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "survey_completions_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "class_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "survey_completions_student_id_fkey"
      columns: ["student_id"]
isOneToOne: true
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"survey_responses": {
                  Row: {
                    "classroom_id": string,"created_at": string,"id": string,"improve_text": string | null,"improve_text_safe": string | null,"like_text": string | null,"like_text_safe": string | null,"q1": number,"q2": number,"q3": number,"q4": number,"q5": number,"q6": number,"q7": number,"q8": number,"session_id": string | null
                  }
                  Insert: {
                    "classroom_id": string,"created_at"?: string,"id"?: string,"improve_text"?: string | null,"improve_text_safe"?: string | null,"like_text"?: string | null,"like_text_safe"?: string | null,"q1": number,"q2": number,"q3": number,"q4": number,"q5": number,"q6": number,"q7": number,"q8": number,"session_id"?: string | null
                  }
                  Update: {
                    "classroom_id"?: string,"created_at"?: string,"id"?: string,"improve_text"?: string | null,"improve_text_safe"?: string | null,"like_text"?: string | null,"like_text_safe"?: string | null,"q1"?: number,"q2"?: number,"q3"?: number,"q4"?: number,"q5"?: number,"q6"?: number,"q7"?: number,"q8"?: number,"session_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "survey_responses_classroom_id_fkey"
      columns: ["classroom_id"]
isOneToOne: false
      referencedRelation: "classrooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "survey_responses_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "class_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"teacher_notes": {
                  Row: {
                    "chips": (string)[],"created_at": string,"id": string,"student_id": string,"teacher_id": string,"text": string | null
                  }
                  Insert: {
                    "chips"?: (string)[],"created_at"?: string,"id"?: string,"student_id": string,"teacher_id": string,"text"?: string | null
                  }
                  Update: {
                    "chips"?: (string)[],"created_at"?: string,"id"?: string,"student_id"?: string,"teacher_id"?: string,"text"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "teacher_notes_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_notes_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    }
                  ]
                },"teacher_overrides": {
                  Row: {
                    "action": string,"after_value": Json | null,"before_value": Json | null,"created_at": string,"id": string,"note": string | null,"reason": string,"student_id": string,"target": string | null,"teacher_id": string
                  }
                  Insert: {
                    "action": string,"after_value"?: Json | null,"before_value"?: Json | null,"created_at"?: string,"id"?: string,"note"?: string | null,"reason": string,"student_id": string,"target"?: string | null,"teacher_id": string
                  }
                  Update: {
                    "action"?: string,"after_value"?: Json | null,"before_value"?: Json | null,"created_at"?: string,"id"?: string,"note"?: string | null,"reason"?: string,"student_id"?: string,"target"?: string | null,"teacher_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teacher_overrides_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_overrides_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    }
                  ]
                },"teacher_password_resets": {
                  Row: {
                    "created_at": string,"expires_at": string,"id": string,"teacher_id": string,"token_hash": string,"used_at": string | null
                  }
                  Insert: {
                    "created_at"?: string,"expires_at": string,"id"?: string,"teacher_id": string,"token_hash": string,"used_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"id"?: string,"teacher_id"?: string,"token_hash"?: string,"used_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "teacher_password_resets_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    }
                  ]
                },"teachers": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"name": string | null
                  }
                  Insert: {
                    "created_at"?: string,"email": string,"id": string,"name"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"name"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"voice_submissions": {
                  Row: {
                    "created_at": string,"duration_sec": number,"expires_at": string,"id": string,"storage_path": string | null,"student_id": string,"transcript_text": string | null
                  }
                  Insert: {
                    "created_at"?: string,"duration_sec"?: number,"expires_at"?: string,"id"?: string,"storage_path"?: string | null,"student_id": string,"transcript_text"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"duration_sec"?: number,"expires_at"?: string,"id"?: string,"storage_path"?: string | null,"student_id"?: string,"transcript_text"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "voice_submissions_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_peer_feedback":
{ Args: { "p_from_student_id": string,"p_praise_text": string,"p_suggest_text": string,"p_to_student_id": string }; Returns: {
              "created_at": string,
"from_student_id": string,
"hidden_at": string | null,
"hidden_by": string | null,
"hidden_reason": string | null,
"id": string,
"praise_text": string,
"suggest_text": string,
"to_student_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "peer_feedback"
        isOneToOne: false
        isSetofReturn: true
      } },
"buddy_candidates_raw":
{ Args: { "p_mission_id": string,"p_student_id": string }; Returns: {
              "accepting_requests": boolean,"declined_seconds_ago": number,"helped_count": number,"helping_now": number,"idle_seconds": number,"in_big_mission": boolean,"likes_talking": boolean,"nickname": string,"paired_with": string,"standing": string,"stars": number,"student_id": string,"waiting_for_teacher": boolean
            }[]
                           },
"cancel_buddy_request":
{ Args: { "p_request_id": string,"p_student_id": string }; Returns: {
              "accepted_at": string | null,
"attempts": number,
"classroom_id": string,
"created_at": string,
"done_at": string | null,
"feedback": string | null,
"helper_id": string | null,
"id": string,
"kind": string,
"mission_id": string,
"requester_id": string,
"requester_passed_after": boolean | null,
"resolved_at": string | null,
"status": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "buddy_requests"
        isOneToOne: false
        isSetofReturn: true
      } },
"claim_next_grade_job":
{ Args: { "p_max_attempts"?: number }; Returns: {
              "ai_result": Json | null,
"attempts": number,
"created_at": string,
"error": string | null,
"id": string,
"input": NonNullable<Json>,
"status": string,
"student_id": string,
"submission_id": string | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "grade_jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"claim_next_story_job":
{ Args: { "p_max_attempts"?: number }; Returns: {
              "attempts": number,
"created_at": string,
"error": string | null,
"id": string,
"input": NonNullable<Json>,
"result": Json | null,
"status": string,
"student_id": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "story_jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"classroom_buddy_helped_counts":
{ Args: { "p_classroom_id": string }; Returns: {
              "helped_count": number,"helping_now": number,"nickname": string,"student_id": string
            }[]
                           },
"classroom_content_flags":
{ Args: { "p_classroom_id": string,"p_include_resolved"?: boolean,"p_min_level"?: number,"p_since"?: string,"p_teacher_id": string }; Returns: {
              "categories": (string)[],"context": string,"created_at": string,"id": string,"is_full_text": boolean,"level": number,"nickname": string,"resolved_at": string,"student_id": string,"text_for_teacher": string
            }[]
                           },
"classroom_efficiency_raw":
{ Args: { "p_classroom_id": string,"p_teacher_id": string }; Returns: {
              "missions": Json,"post_test_score": number,"pre_test_score": number,"rubric_scores": Json,"student_id": string
            }[]
                           },
"classroom_open_buddy_requests":
{ Args: { "p_classroom_id": string,"p_teacher_id": string }; Returns: {
              "attempts": number,"created_at": string,"helper": string,"helper_id": string,"id": string,"kind": string,"mission_id": string,"requester": string,"requester_id": string,"status": string,"waiting_seconds": number
            }[]
                           },
"classroom_peer_feedback":
{ Args: { "p_classroom_id": string,"p_teacher_id": string }; Returns: {
              "created_at": string,
"from_student_id": string,
"hidden_at": string | null,
"hidden_by": string | null,
"hidden_reason": string | null,
"id": string,
"praise_text": string,
"suggest_text": string,
"to_student_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "peer_feedback"
        isOneToOne: false
        isSetofReturn: true
      } },
"classroom_plan_requests":
{ Args: { "p_classroom_id": string,"p_include_answered"?: boolean,"p_teacher_id": string }; Returns: {
              "created_at": string,"granted_value": string,"id": string,"kind": string,"mission_id": string,"nickname": string,"reason": string,"requested_value": string,"responded_at": string,"status": string,"student_id": string,"teacher_response": string
            }[]
                           },
"classroom_quiz_item_sheets":
{ Args: { "p_classroom_id": string,"p_teacher_id": string }; Returns: {
              "is_correct": boolean,"item_id": string,"quiz_set": string,"student_id": string
            }[]
                           },
"classroom_report":
{ Args: { "p_classroom_id": string,"p_teacher_id": string }; Returns: Json
                           },
"classroom_report_raw":
{ Args: { "p_classroom_id": string,"p_teacher_id": string }; Returns: Json
                           },
"classroom_screen_stats":
{ Args: { "p_classroom_id": string,"p_teacher_id": string }; Returns: {
              "joined": number,"missions_passed": number,"submitted": number
            }[]
                           },
"classroom_showcase":
{ Args: { "p_classroom_id": string,"p_student_id": string }; Returns: {
              "domain_name": string,"nickname": string,"peer_visible": boolean,"reason_text": string,"tld": string
            }[]
                           },
"classroom_showcase_extras":
{ Args: { "p_classroom_id": string,"p_student_id": string }; Returns: {
              "business_name": string,"business_type": string,"liked_by_me": boolean,"likes": number,"nickname": string,"praises": number
            }[]
                           },
"classroom_voice_paths":
{ Args: { "p_classroom_id": string,"p_teacher_id": string }; Returns: {
              "id": string,"storage_path": string
            }[]
                           },
"close_class_session":
{ Args: { "p_session_id": string,"p_teacher_id": string }; Returns: {
              "ai_enabled": boolean,
"allow_early_boss": boolean,
"allow_skip_missions": boolean,
"class_minutes": number,
"classroom_id": string,
"created_at": string,
"ended_at": string | null,
"focus_screen": boolean,
"focus_screen_at": string | null,
"home_deadline": string | null,
"id": string,
"phase": string,
"phase_changed_by": string | null,
"phase_minutes": NonNullable<Json>,
"phase_minutes_custom": boolean,
"phase_started_at": string,
"posttest_closed_at": string | null,
"posttest_enabled": boolean,
"posttest_opened_at": string | null,
"pretest_closed_at": string | null,
"pretest_enabled": boolean,
"pretest_opened_at": string | null,
"previous_phase": string | null,
"previous_phase_at": string | null,
"showcase_enabled": boolean,
"started_at": string,
"survey_enabled": boolean,
"timer_end_at": string | null,
"timer_extended_seconds": number,
"timer_paused_seconds": number | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "class_sessions"
        isOneToOne: false
        isSetofReturn: true
      } },
"complete_buddy_request":
{ Args: { "p_feedback"?: string,"p_passed_after"?: boolean,"p_request_id": string,"p_student_id": string }; Returns: {
              "accepted_at": string | null,
"attempts": number,
"classroom_id": string,
"created_at": string,
"done_at": string | null,
"feedback": string | null,
"helper_id": string | null,
"id": string,
"kind": string,
"mission_id": string,
"requester_id": string,
"requester_passed_after": boolean | null,
"resolved_at": string | null,
"status": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "buddy_requests"
        isOneToOne: false
        isSetofReturn: true
      } },
"complete_grade_job":
{ Args: { "p_ai_result": Json,"p_job_id": string }; Returns: {
              "ai_result": Json | null,
"attempts": number,
"created_at": string,
"error": string | null,
"id": string,
"input": NonNullable<Json>,
"status": string,
"student_id": string,
"submission_id": string | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "grade_jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"complete_story_job":
{ Args: { "p_job_id": string,"p_result": Json }; Returns: {
              "attempts": number,
"created_at": string,
"error": string | null,
"id": string,
"input": NonNullable<Json>,
"result": Json | null,
"status": string,
"student_id": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "story_jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"confirm_submission_scores":
{ Args: { "p_scores": Json,"p_submission_id": string,"p_teacher_id": string }; Returns: {
              "ai_scores": Json | null,
"ai_scores_snapshot": Json | null,
"confirmed_at": string | null,
"confirmed_by": string | null,
"created_at": string,
"domain_name": string,
"emphasis_changed_count": number,
"emphasis_criterion": string | null,
"format": string,
"id": string,
"needs_review": boolean,
"peer_visible": boolean | null,
"pin_hide_name": boolean,
"pinned_at": string | null,
"pinned_by": string | null,
"reason_text": string | null,
"self_scores": Json | null,
"student_id": string,
"teacher_changed": boolean | null,
"teacher_confirmed_scores": Json | null,
"teacher_scores_before": Json | null,
"tld": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "submissions"
        isOneToOne: false
        isSetofReturn: true
      } },
"consume_teacher_password_reset":
{ Args: { "p_token": string }; Returns: {
              "email": string,"teacher_id": string
            }[]
                           },
"create_buddy_request":
{ Args: { "p_kind"?: string,"p_mission_id": string,"p_student_id": string }; Returns: {
              "accepted_at": string | null,
"attempts": number,
"classroom_id": string,
"created_at": string,
"done_at": string | null,
"feedback": string | null,
"helper_id": string | null,
"id": string,
"kind": string,
"mission_id": string,
"requester_id": string,
"requester_passed_after": boolean | null,
"resolved_at": string | null,
"status": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "buddy_requests"
        isOneToOne: false
        isSetofReturn: true
      } },
"create_plan_request":
{ Args: { "p_kind": string,"p_mission_id"?: string,"p_reason": string,"p_requested_value"?: string,"p_student_id": string }; Returns: {
              "classroom_id": string,
"created_at": string,
"granted_value": string | null,
"id": string,
"kind": string,
"mission_id": string | null,
"reason": string,
"requested_value": string | null,
"responded_at": string | null,
"responded_by": string | null,
"status": string,
"student_id": string,
"teacher_response": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "plan_requests"
        isOneToOne: false
        isSetofReturn: true
      } },
"default_phase_minutes":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"delete_voice_submission":
{ Args: { "p_teacher_id": string,"p_voice_id": string }; Returns: {
              "id": string,"storage_path": string
            }[]
                           },
"ensure_class_session":
{ Args: { "p_classroom_id": string,"p_teacher_id": string }; Returns: {
              "ai_enabled": boolean,
"allow_early_boss": boolean,
"allow_skip_missions": boolean,
"class_minutes": number,
"classroom_id": string,
"created_at": string,
"ended_at": string | null,
"focus_screen": boolean,
"focus_screen_at": string | null,
"home_deadline": string | null,
"id": string,
"phase": string,
"phase_changed_by": string | null,
"phase_minutes": NonNullable<Json>,
"phase_minutes_custom": boolean,
"phase_started_at": string,
"posttest_closed_at": string | null,
"posttest_enabled": boolean,
"posttest_opened_at": string | null,
"pretest_closed_at": string | null,
"pretest_enabled": boolean,
"pretest_opened_at": string | null,
"previous_phase": string | null,
"previous_phase_at": string | null,
"showcase_enabled": boolean,
"started_at": string,
"survey_enabled": boolean,
"timer_end_at": string | null,
"timer_extended_seconds": number,
"timer_paused_seconds": number | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "class_sessions"
        isOneToOne: false
        isSetofReturn: true
      } },
"expire_buddy_offers":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"expire_voice_submissions":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"storage_path": string
            }[]
                           },
"extend_session_timer":
{ Args: { "p_add_seconds": number,"p_session_id": string,"p_teacher_id": string }; Returns: {
              "ai_enabled": boolean,
"allow_early_boss": boolean,
"allow_skip_missions": boolean,
"class_minutes": number,
"classroom_id": string,
"created_at": string,
"ended_at": string | null,
"focus_screen": boolean,
"focus_screen_at": string | null,
"home_deadline": string | null,
"id": string,
"phase": string,
"phase_changed_by": string | null,
"phase_minutes": NonNullable<Json>,
"phase_minutes_custom": boolean,
"phase_started_at": string,
"posttest_closed_at": string | null,
"posttest_enabled": boolean,
"posttest_opened_at": string | null,
"pretest_closed_at": string | null,
"pretest_enabled": boolean,
"pretest_opened_at": string | null,
"previous_phase": string | null,
"previous_phase_at": string | null,
"showcase_enabled": boolean,
"started_at": string,
"survey_enabled": boolean,
"timer_end_at": string | null,
"timer_extended_seconds": number,
"timer_paused_seconds": number | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "class_sessions"
        isOneToOne: false
        isSetofReturn: true
      } },
"fail_grade_job":
{ Args: { "p_error": string,"p_job_id": string,"p_max_attempts"?: number }; Returns: {
              "ai_result": Json | null,
"attempts": number,
"created_at": string,
"error": string | null,
"id": string,
"input": NonNullable<Json>,
"status": string,
"student_id": string,
"submission_id": string | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "grade_jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"fail_story_job":
{ Args: { "p_error": string,"p_job_id": string,"p_max_attempts"?: number,"p_retry"?: boolean }; Returns: {
              "attempts": number,
"created_at": string,
"error": string | null,
"id": string,
"input": NonNullable<Json>,
"result": Json | null,
"status": string,
"student_id": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "story_jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"find_buddy_candidates":
{ Args: { "p_limit"?: number,"p_mission_id": string,"p_student_id": string }; Returns: {
              "nickname": string,"score": number,"student_id": string
            }[]
                           },
"find_student_story_job":
{ Args: { "p_student_id": string }; Returns: {
              "attempts": number,
"created_at": string,
"error": string | null,
"id": string,
"input": NonNullable<Json>,
"result": Json | null,
"status": string,
"student_id": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "story_jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"home_write_blocked":
{ Args: { "p_student_id": string }; Returns: boolean
                           },
"increment_mission_hint":
{ Args: { "p_max_hints"?: number,"p_mission_id": string,"p_student_id": string }; Returns: {
              "attempts": number,
"channel_used": string | null,
"forced_pass_at": string | null,
"forced_pass_by": string | null,
"hints_used": number,
"id": string,
"level_override": number | null,
"mission_id": string,
"passed_at": string | null,
"skip_allowed": boolean | null,
"skipped_by": string | null,
"stars": number,
"started_at": string | null,
"student_id": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "mission_progress"
        isOneToOne: false
        isSetofReturn: true
      } },
"is_classroom_owner":
{ Args: { "p_classroom_id": string }; Returns: boolean
                           },
"issue_teacher_password_reset":
{ Args: { "p_email": string,"p_ttl_minutes"?: number }; Returns: {
              "expires_at": string,"teacher_id": string,"token": string
            }[]
                           },
"offer_buddy_request":
{ Args: { "p_helper_id": string,"p_match_score"?: number,"p_request_id": string,"p_seconds"?: number }; Returns: {
              "attempt_no": number,
"expires_at": string,
"helper_id": string,
"id": string,
"match_score": number | null,
"request_id": string,
"responded_at": string | null,
"sent_at": string,
"status": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "buddy_offers"
        isOneToOne: false
        isSetofReturn: true
      } },
"owns_student":
{ Args: { "p_student_id": string }; Returns: boolean
                           },
"pause_session_timer":
{ Args: { "p_paused": boolean,"p_session_id": string,"p_teacher_id": string }; Returns: {
              "ai_enabled": boolean,
"allow_early_boss": boolean,
"allow_skip_missions": boolean,
"class_minutes": number,
"classroom_id": string,
"created_at": string,
"ended_at": string | null,
"focus_screen": boolean,
"focus_screen_at": string | null,
"home_deadline": string | null,
"id": string,
"phase": string,
"phase_changed_by": string | null,
"phase_minutes": NonNullable<Json>,
"phase_minutes_custom": boolean,
"phase_started_at": string,
"posttest_closed_at": string | null,
"posttest_enabled": boolean,
"posttest_opened_at": string | null,
"pretest_closed_at": string | null,
"pretest_enabled": boolean,
"pretest_opened_at": string | null,
"previous_phase": string | null,
"previous_phase_at": string | null,
"showcase_enabled": boolean,
"started_at": string,
"survey_enabled": boolean,
"timer_end_at": string | null,
"timer_extended_seconds": number,
"timer_paused_seconds": number | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "class_sessions"
        isOneToOne: false
        isSetofReturn: true
      } },
"pinned_showcase":
{ Args: { "p_classroom_id": string,"p_teacher_id": string }; Returns: {
              "domain_name": string,"nickname": string,"pinned_at": string,"reason_text": string,"submission_id": string,"tld": string
            }[]
                           },
"purge_teacher_password_resets":
{ Args: { "p_older_than_hours"?: number }; Returns: number
                           },
"recalc_student_stars":
{ Args: { "p_student_id": string }; Returns: {
              "audience": string | null,
"boss_template_id": string | null,
"business_edit_unlocked": boolean,
"business_name": string | null,
"business_type": string | null,
"certificate_display_name": string | null,
"channel_chosen_by": string | null,
"channel_suggested": string | null,
"channel_switches": number,
"confidence": NonNullable<Json>,
"domain_name": string | null,
"earned_stars": number,
"goal_id": string | null,
"goal_raised_at": string | null,
"goal_raised_count": number,
"goal_stars": number | null,
"hints_toggled_by": string | null,
"is_registered_company": boolean | null,
"learning_route": string | null,
"level_by_objective": NonNullable<Json>,
"level_overridden_by_student": NonNullable<Json>,
"level_suggested": number | null,
"own_goal_text": string | null,
"post_test_score": number | null,
"pre_test_score": number | null,
"readiness": NonNullable<Json>,
"scaffold_level": number,
"self_goal_level": number | null,
"student_id": string,
"talent_id": string | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: false
        isSetofReturn: true
      } },
"reclaim_stale_grade_jobs":
{ Args: { "p_older_than_minutes"?: number }; Returns: {
              "ai_result": Json | null,
"attempts": number,
"created_at": string,
"error": string | null,
"id": string,
"input": NonNullable<Json>,
"status": string,
"student_id": string,
"submission_id": string | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "grade_jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"reclaim_stale_story_jobs":
{ Args: { "p_older_than_minutes"?: number }; Returns: {
              "attempts": number,
"created_at": string,
"error": string | null,
"id": string,
"input": NonNullable<Json>,
"result": Json | null,
"status": string,
"student_id": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "story_jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"record_content_flag":
{ Args: { "p_categories"?: (string)[],"p_context": string,"p_level": number,"p_masked_text"?: string,"p_original_text"?: string,"p_student_id": string }; Returns: {
              "categories": (string)[],
"classroom_id": string,
"context": string,
"created_at": string,
"id": string,
"level": number,
"masked_text": string | null,
"original_text": string,
"resolved_at": string | null,
"resolved_by": string | null,
"student_id": string | null,
"teacher_note": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "content_flags"
        isOneToOne: false
        isSetofReturn: true
      } },
"record_level_override":
{ Args: { "p_mission_id"?: string,"p_student_id": string,"p_to_level": number }; Returns: {
              "audience": string | null,
"boss_template_id": string | null,
"business_edit_unlocked": boolean,
"business_name": string | null,
"business_type": string | null,
"certificate_display_name": string | null,
"channel_chosen_by": string | null,
"channel_suggested": string | null,
"channel_switches": number,
"confidence": NonNullable<Json>,
"domain_name": string | null,
"earned_stars": number,
"goal_id": string | null,
"goal_raised_at": string | null,
"goal_raised_count": number,
"goal_stars": number | null,
"hints_toggled_by": string | null,
"is_registered_company": boolean | null,
"learning_route": string | null,
"level_by_objective": NonNullable<Json>,
"level_overridden_by_student": NonNullable<Json>,
"level_suggested": number | null,
"own_goal_text": string | null,
"post_test_score": number | null,
"pre_test_score": number | null,
"readiness": NonNullable<Json>,
"scaffold_level": number,
"self_goal_level": number | null,
"student_id": string,
"talent_id": string | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: false
        isSetofReturn: true
      } },
"record_mission_attempt":
{ Args: { "p_channel"?: string,"p_correct": boolean,"p_hint_level"?: number,"p_mission_id": string,"p_student_id": string }; Returns: {
              "attempts": number,
"channel_used": string | null,
"forced_pass_at": string | null,
"forced_pass_by": string | null,
"hints_used": number,
"id": string,
"level_override": number | null,
"mission_id": string,
"passed_at": string | null,
"skip_allowed": boolean | null,
"skipped_by": string | null,
"stars": number,
"started_at": string | null,
"student_id": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "mission_progress"
        isOneToOne: false
        isSetofReturn: true
      } },
"record_mission_skip":
{ Args: { "p_by"?: string,"p_mission_id": string,"p_reason"?: string,"p_student_id": string }; Returns: {
              "id": string,
"mission_id": string,
"reason": string | null,
"skipped_at": string,
"student_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "mission_skips"
        isOneToOne: false
        isSetofReturn: true
      } },
"record_pre_join_content_flag":
{ Args: { "p_categories"?: (string)[],"p_classroom_id": string,"p_level": number,"p_masked_text"?: string,"p_original_text"?: string }; Returns: {
              "categories": (string)[],
"classroom_id": string,
"context": string,
"created_at": string,
"id": string,
"level": number,
"masked_text": string | null,
"original_text": string,
"resolved_at": string | null,
"resolved_by": string | null,
"student_id": string | null,
"teacher_note": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "content_flags"
        isOneToOne: false
        isSetofReturn: true
      } },
"record_quiz_item_responses":
{ Args: { "p_items": Json,"p_quiz_set": string,"p_student_id": string }; Returns: number
                           },
"record_route_change":
{ Args: { "p_changed_by"?: string,"p_from_route"?: string,"p_mission_id"?: string,"p_student_id": string,"p_to_route": string }; Returns: {
              "changed_at": string,
"changed_by": string,
"from_route": string | null,
"id": string,
"mission_id": string | null,
"student_id": string,
"to_route": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "route_changes"
        isOneToOne: false
        isSetofReturn: true
      } },
"reset_demo_classroom":
{ Args: { "p_classroom_id": string,"p_teacher_id": string }; Returns: {
              "deleted_broadcasts": number,"deleted_flags": number,"deleted_plan_requests": number,"deleted_quiz_items": number,"deleted_sessions": number,"deleted_students": number,"deleted_surveys": number
            }[]
                           },
"resolve_content_flag":
{ Args: { "p_flag_id": string,"p_note"?: string,"p_teacher_id": string }; Returns: {
              "categories": (string)[],
"classroom_id": string,
"context": string,
"created_at": string,
"id": string,
"level": number,
"masked_text": string | null,
"original_text": string,
"resolved_at": string | null,
"resolved_by": string | null,
"student_id": string | null,
"teacher_note": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "content_flags"
        isOneToOne: false
        isSetofReturn: true
      } },
"respond_buddy_offer":
{ Args: { "p_accept": boolean,"p_helper_id": string,"p_offer_id": string }; Returns: {
              "attempt_no": number,
"expires_at": string,
"helper_id": string,
"id": string,
"match_score": number | null,
"request_id": string,
"responded_at": string | null,
"sent_at": string,
"status": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "buddy_offers"
        isOneToOne: false
        isSetofReturn: true
      } },
"respond_plan_request":
{ Args: { "p_granted_value"?: string,"p_request_id": string,"p_response"?: string,"p_status": string,"p_teacher_id": string }; Returns: {
              "classroom_id": string,
"created_at": string,
"granted_value": string | null,
"id": string,
"kind": string,
"mission_id": string | null,
"reason": string,
"requested_value": string | null,
"responded_at": string | null,
"responded_by": string | null,
"status": string,
"student_id": string,
"teacher_response": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "plan_requests"
        isOneToOne: false
        isSetofReturn: true
      } },
"revert_session_phase":
{ Args: { "p_session_id": string,"p_teacher_id": string,"p_within_seconds"?: number }; Returns: {
              "ai_enabled": boolean,
"allow_early_boss": boolean,
"allow_skip_missions": boolean,
"class_minutes": number,
"classroom_id": string,
"created_at": string,
"ended_at": string | null,
"focus_screen": boolean,
"focus_screen_at": string | null,
"home_deadline": string | null,
"id": string,
"phase": string,
"phase_changed_by": string | null,
"phase_minutes": NonNullable<Json>,
"phase_minutes_custom": boolean,
"phase_started_at": string,
"posttest_closed_at": string | null,
"posttest_enabled": boolean,
"posttest_opened_at": string | null,
"pretest_closed_at": string | null,
"pretest_enabled": boolean,
"pretest_opened_at": string | null,
"previous_phase": string | null,
"previous_phase_at": string | null,
"showcase_enabled": boolean,
"started_at": string,
"survey_enabled": boolean,
"timer_end_at": string | null,
"timer_extended_seconds": number,
"timer_paused_seconds": number | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "class_sessions"
        isOneToOne: false
        isSetofReturn: true
      } },
"revoke_student_phase_unlock":
{ Args: { "p_phase": string,"p_student_id": string,"p_teacher_id": string }; Returns: {
              "granted_at": string,
"granted_by": string | null,
"id": string,
"note": string | null,
"phase": string,
"revoked_at": string | null,
"student_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "student_phase_unlocks"
        isOneToOne: false
        isSetofReturn: true
      } },
"rls_status":
{ Args: Record<PropertyKey, never>; Returns: {
              "rls_enabled": boolean,"table_name": string
            }[]
                           },
"send_broadcast":
{ Args: { "p_classroom_id": string,"p_min_seconds"?: number,"p_target"?: string,"p_target_value"?: string,"p_teacher_id": string,"p_text": string }; Returns: {
              "classroom_id": string,
"id": string,
"sent_at": string,
"session_id": string | null,
"target": string,
"target_value": string | null,
"teacher_id": string,
"text": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "broadcasts"
        isOneToOne: false
        isSetofReturn: true
      } },
"session_ai_enabled":
{ Args: { "p_student_id": string }; Returns: boolean
                           },
"set_class_plan":
{ Args: { "p_allow_skip_missions"?: boolean,"p_class_minutes"?: number,"p_phase_minutes"?: Json,"p_session_id": string,"p_teacher_id": string }; Returns: {
              "ai_enabled": boolean,
"allow_early_boss": boolean,
"allow_skip_missions": boolean,
"class_minutes": number,
"classroom_id": string,
"created_at": string,
"ended_at": string | null,
"focus_screen": boolean,
"focus_screen_at": string | null,
"home_deadline": string | null,
"id": string,
"phase": string,
"phase_changed_by": string | null,
"phase_minutes": NonNullable<Json>,
"phase_minutes_custom": boolean,
"phase_started_at": string,
"posttest_closed_at": string | null,
"posttest_enabled": boolean,
"posttest_opened_at": string | null,
"pretest_closed_at": string | null,
"pretest_enabled": boolean,
"pretest_opened_at": string | null,
"previous_phase": string | null,
"previous_phase_at": string | null,
"showcase_enabled": boolean,
"started_at": string,
"survey_enabled": boolean,
"timer_end_at": string | null,
"timer_extended_seconds": number,
"timer_paused_seconds": number | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "class_sessions"
        isOneToOne: false
        isSetofReturn: true
      } },
"set_focus_screen":
{ Args: { "p_on": boolean,"p_session_id": string,"p_teacher_id": string }; Returns: {
              "ai_enabled": boolean,
"allow_early_boss": boolean,
"allow_skip_missions": boolean,
"class_minutes": number,
"classroom_id": string,
"created_at": string,
"ended_at": string | null,
"focus_screen": boolean,
"focus_screen_at": string | null,
"home_deadline": string | null,
"id": string,
"phase": string,
"phase_changed_by": string | null,
"phase_minutes": NonNullable<Json>,
"phase_minutes_custom": boolean,
"phase_started_at": string,
"posttest_closed_at": string | null,
"posttest_enabled": boolean,
"posttest_opened_at": string | null,
"pretest_closed_at": string | null,
"pretest_enabled": boolean,
"pretest_opened_at": string | null,
"previous_phase": string | null,
"previous_phase_at": string | null,
"showcase_enabled": boolean,
"started_at": string,
"survey_enabled": boolean,
"timer_end_at": string | null,
"timer_extended_seconds": number,
"timer_paused_seconds": number | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "class_sessions"
        isOneToOne: false
        isSetofReturn: true
      } },
"set_home_deadline":
{ Args: { "p_deadline"?: string,"p_session_id": string,"p_teacher_id": string }; Returns: {
              "ai_enabled": boolean,
"allow_early_boss": boolean,
"allow_skip_missions": boolean,
"class_minutes": number,
"classroom_id": string,
"created_at": string,
"ended_at": string | null,
"focus_screen": boolean,
"focus_screen_at": string | null,
"home_deadline": string | null,
"id": string,
"phase": string,
"phase_changed_by": string | null,
"phase_minutes": NonNullable<Json>,
"phase_minutes_custom": boolean,
"phase_started_at": string,
"posttest_closed_at": string | null,
"posttest_enabled": boolean,
"posttest_opened_at": string | null,
"pretest_closed_at": string | null,
"pretest_enabled": boolean,
"pretest_opened_at": string | null,
"previous_phase": string | null,
"previous_phase_at": string | null,
"showcase_enabled": boolean,
"started_at": string,
"survey_enabled": boolean,
"timer_end_at": string | null,
"timer_extended_seconds": number,
"timer_paused_seconds": number | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "class_sessions"
        isOneToOne: false
        isSetofReturn: true
      } },
"set_self_goal":
{ Args: { "p_goal_id": string,"p_goal_stars": number,"p_self_goal_level": number,"p_student_id": string }; Returns: {
              "audience": string | null,
"boss_template_id": string | null,
"business_edit_unlocked": boolean,
"business_name": string | null,
"business_type": string | null,
"certificate_display_name": string | null,
"channel_chosen_by": string | null,
"channel_suggested": string | null,
"channel_switches": number,
"confidence": NonNullable<Json>,
"domain_name": string | null,
"earned_stars": number,
"goal_id": string | null,
"goal_raised_at": string | null,
"goal_raised_count": number,
"goal_stars": number | null,
"hints_toggled_by": string | null,
"is_registered_company": boolean | null,
"learning_route": string | null,
"level_by_objective": NonNullable<Json>,
"level_overridden_by_student": NonNullable<Json>,
"level_suggested": number | null,
"own_goal_text": string | null,
"post_test_score": number | null,
"pre_test_score": number | null,
"readiness": NonNullable<Json>,
"scaffold_level": number,
"self_goal_level": number | null,
"student_id": string,
"talent_id": string | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: false
        isSetofReturn: true
      } },
"set_session_phase":
{ Args: { "p_phase": string,"p_session_id": string,"p_teacher_id": string,"p_timer_seconds"?: number }; Returns: {
              "ai_enabled": boolean,
"allow_early_boss": boolean,
"allow_skip_missions": boolean,
"class_minutes": number,
"classroom_id": string,
"created_at": string,
"ended_at": string | null,
"focus_screen": boolean,
"focus_screen_at": string | null,
"home_deadline": string | null,
"id": string,
"phase": string,
"phase_changed_by": string | null,
"phase_minutes": NonNullable<Json>,
"phase_minutes_custom": boolean,
"phase_started_at": string,
"posttest_closed_at": string | null,
"posttest_enabled": boolean,
"posttest_opened_at": string | null,
"pretest_closed_at": string | null,
"pretest_enabled": boolean,
"pretest_opened_at": string | null,
"previous_phase": string | null,
"previous_phase_at": string | null,
"showcase_enabled": boolean,
"started_at": string,
"survey_enabled": boolean,
"timer_end_at": string | null,
"timer_extended_seconds": number,
"timer_paused_seconds": number | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "class_sessions"
        isOneToOne: false
        isSetofReturn: true
      } },
"set_session_timer":
{ Args: { "p_seconds": number,"p_session_id": string,"p_teacher_id": string }; Returns: {
              "ai_enabled": boolean,
"allow_early_boss": boolean,
"allow_skip_missions": boolean,
"class_minutes": number,
"classroom_id": string,
"created_at": string,
"ended_at": string | null,
"focus_screen": boolean,
"focus_screen_at": string | null,
"home_deadline": string | null,
"id": string,
"phase": string,
"phase_changed_by": string | null,
"phase_minutes": NonNullable<Json>,
"phase_minutes_custom": boolean,
"phase_started_at": string,
"posttest_closed_at": string | null,
"posttest_enabled": boolean,
"posttest_opened_at": string | null,
"pretest_closed_at": string | null,
"pretest_enabled": boolean,
"pretest_opened_at": string | null,
"previous_phase": string | null,
"previous_phase_at": string | null,
"showcase_enabled": boolean,
"started_at": string,
"survey_enabled": boolean,
"timer_end_at": string | null,
"timer_extended_seconds": number,
"timer_paused_seconds": number | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "class_sessions"
        isOneToOne: false
        isSetofReturn: true
      } },
"set_showcase_like":
{ Args: { "p_from_student_id": string,"p_liked": boolean,"p_to_student_id": string }; Returns: {
              "liked": boolean,"likes": number
            }[]
                           },
"set_test_window":
{ Args: { "p_enabled": boolean,"p_session_id": string,"p_teacher_id": string,"p_which": string }; Returns: {
              "ai_enabled": boolean,
"allow_early_boss": boolean,
"allow_skip_missions": boolean,
"class_minutes": number,
"classroom_id": string,
"created_at": string,
"ended_at": string | null,
"focus_screen": boolean,
"focus_screen_at": string | null,
"home_deadline": string | null,
"id": string,
"phase": string,
"phase_changed_by": string | null,
"phase_minutes": NonNullable<Json>,
"phase_minutes_custom": boolean,
"phase_started_at": string,
"posttest_closed_at": string | null,
"posttest_enabled": boolean,
"posttest_opened_at": string | null,
"pretest_closed_at": string | null,
"pretest_enabled": boolean,
"pretest_opened_at": string | null,
"previous_phase": string | null,
"previous_phase_at": string | null,
"showcase_enabled": boolean,
"started_at": string,
"survey_enabled": boolean,
"timer_end_at": string | null,
"timer_extended_seconds": number,
"timer_paused_seconds": number | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "class_sessions"
        isOneToOne: false
        isSetofReturn: true
      } },
"student_override_history":
{ Args: { "p_student_id": string,"p_teacher_id": string }; Returns: {
              "action": string,
"after_value": Json | null,
"before_value": Json | null,
"created_at": string,
"id": string,
"note": string | null,
"reason": string,
"student_id": string,
"target": string | null,
"teacher_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "teacher_overrides"
        isOneToOne: false
        isSetofReturn: true
      } },
"student_report":
{ Args: { "p_student_id": string,"p_teacher_id": string }; Returns: Json
                           },
"students_without_feedback":
{ Args: { "p_classroom_id": string,"p_teacher_id": string }; Returns: {
              "nickname": string,"student_id": string
            }[]
                           },
"submit_survey_response":
{ Args: { "p_improve_text"?: string,"p_improve_text_safe"?: string,"p_like_text"?: string,"p_like_text_safe"?: string,"p_scores": Json,"p_student_id": string }; Returns: boolean
                           },
"survey_summary":
{ Args: { "p_classroom_id": string,"p_teacher_id": string }; Returns: Json
                           },
"switch_learning_route":
{ Args: { "p_chosen_by"?: string,"p_mission_id"?: string,"p_student_id": string,"p_to_route": string }; Returns: {
              "changed_at": string,
"changed_by": string,
"from_route": string | null,
"id": string,
"mission_id": string | null,
"student_id": string,
"to_route": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "route_changes"
        isOneToOne: false
        isSetofReturn: true
      } },
"teacher_add_note":
{ Args: { "p_chips"?: (string)[],"p_student_id": string,"p_teacher_id": string,"p_text"?: string }; Returns: {
              "chips": (string)[],
"created_at": string,
"id": string,
"student_id": string,
"teacher_id": string,
"text": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "teacher_notes"
        isOneToOne: false
        isSetofReturn: true
      } },
"teacher_allow_skip":
{ Args: { "p_allow": boolean,"p_mission_id": string,"p_note"?: string,"p_reason"?: string,"p_student_id": string,"p_teacher_id": string }; Returns: {
              "attempts": number,
"channel_used": string | null,
"forced_pass_at": string | null,
"forced_pass_by": string | null,
"hints_used": number,
"id": string,
"level_override": number | null,
"mission_id": string,
"passed_at": string | null,
"skip_allowed": boolean | null,
"skipped_by": string | null,
"stars": number,
"started_at": string | null,
"student_id": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "mission_progress"
        isOneToOne: false
        isSetofReturn: true
      } },
"teacher_force_pass":
{ Args: { "p_mission_id": string,"p_note"?: string,"p_reason"?: string,"p_student_id": string,"p_teacher_id": string }; Returns: {
              "attempts": number,
"channel_used": string | null,
"forced_pass_at": string | null,
"forced_pass_by": string | null,
"hints_used": number,
"id": string,
"level_override": number | null,
"mission_id": string,
"passed_at": string | null,
"skip_allowed": boolean | null,
"skipped_by": string | null,
"stars": number,
"started_at": string | null,
"student_id": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "mission_progress"
        isOneToOne: false
        isSetofReturn: true
      } },
"teacher_hide_feedback":
{ Args: { "p_feedback_id": string,"p_hidden": boolean,"p_reason"?: string,"p_teacher_id": string }; Returns: {
              "created_at": string,
"from_student_id": string,
"hidden_at": string | null,
"hidden_by": string | null,
"hidden_reason": string | null,
"id": string,
"praise_text": string,
"suggest_text": string,
"to_student_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "peer_feedback"
        isOneToOne: false
        isSetofReturn: true
      } },
"teacher_open_boss":
{ Args: { "p_note"?: string,"p_reason"?: string,"p_student_id": string,"p_teacher_id": string }; Returns: {
              "granted_at": string,
"granted_by": string | null,
"id": string,
"note": string | null,
"phase": string,
"revoked_at": string | null,
"student_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "student_phase_unlocks"
        isOneToOne: false
        isSetofReturn: true
      } },
"teacher_owns_student":
{ Args: { "p_student_id": string,"p_teacher_id": string }; Returns: boolean
                           },
"teacher_pin_submission":
{ Args: { "p_hide_name"?: boolean,"p_pinned": boolean,"p_submission_id": string,"p_teacher_id": string }; Returns: {
              "ai_scores": Json | null,
"ai_scores_snapshot": Json | null,
"confirmed_at": string | null,
"confirmed_by": string | null,
"created_at": string,
"domain_name": string,
"emphasis_changed_count": number,
"emphasis_criterion": string | null,
"format": string,
"id": string,
"needs_review": boolean,
"peer_visible": boolean | null,
"pin_hide_name": boolean,
"pinned_at": string | null,
"pinned_by": string | null,
"reason_text": string | null,
"self_scores": Json | null,
"student_id": string,
"teacher_changed": boolean | null,
"teacher_confirmed_scores": Json | null,
"teacher_scores_before": Json | null,
"tld": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "submissions"
        isOneToOne: false
        isSetofReturn: true
      } },
"teacher_reset_pin":
{ Args: { "p_note"?: string,"p_pin_hash": string,"p_reason"?: string,"p_student_id": string,"p_teacher_id": string }; Returns: {
              "accepts_buddy_requests": boolean,
"buddy_helped_count": number,
"classroom_id": string,
"created_at": string,
"current_screen": string | null,
"device_token": string | null,
"id": string,
"last_seen_at": string | null,
"must_change_pin": boolean,
"nickname": string,
"pin_hash": string,
"pin_reset_at": string | null,
"pin_reset_by": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "students"
        isOneToOne: false
        isSetofReturn: true
      } },
"teacher_set_boss_template":
{ Args: { "p_note"?: string,"p_reason"?: string,"p_student_id": string,"p_teacher_id": string,"p_template_id": string }; Returns: {
              "audience": string | null,
"boss_template_id": string | null,
"business_edit_unlocked": boolean,
"business_name": string | null,
"business_type": string | null,
"certificate_display_name": string | null,
"channel_chosen_by": string | null,
"channel_suggested": string | null,
"channel_switches": number,
"confidence": NonNullable<Json>,
"domain_name": string | null,
"earned_stars": number,
"goal_id": string | null,
"goal_raised_at": string | null,
"goal_raised_count": number,
"goal_stars": number | null,
"hints_toggled_by": string | null,
"is_registered_company": boolean | null,
"learning_route": string | null,
"level_by_objective": NonNullable<Json>,
"level_overridden_by_student": NonNullable<Json>,
"level_suggested": number | null,
"own_goal_text": string | null,
"post_test_score": number | null,
"pre_test_score": number | null,
"readiness": NonNullable<Json>,
"scaffold_level": number,
"self_goal_level": number | null,
"student_id": string,
"talent_id": string | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: false
        isSetofReturn: true
      } },
"teacher_set_mission_level":
{ Args: { "p_level": number,"p_mission_id": string,"p_note"?: string,"p_reason"?: string,"p_student_id": string,"p_teacher_id": string }; Returns: {
              "attempts": number,
"channel_used": string | null,
"forced_pass_at": string | null,
"forced_pass_by": string | null,
"hints_used": number,
"id": string,
"level_override": number | null,
"mission_id": string,
"passed_at": string | null,
"skip_allowed": boolean | null,
"skipped_by": string | null,
"stars": number,
"started_at": string | null,
"student_id": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "mission_progress"
        isOneToOne: false
        isSetofReturn: true
      } },
"teacher_set_mission_stars":
{ Args: { "p_mission_id": string,"p_stars": number,"p_student_id": string,"p_teacher_id": string }; Returns: {
              "audience": string | null,
"boss_template_id": string | null,
"business_edit_unlocked": boolean,
"business_name": string | null,
"business_type": string | null,
"certificate_display_name": string | null,
"channel_chosen_by": string | null,
"channel_suggested": string | null,
"channel_switches": number,
"confidence": NonNullable<Json>,
"domain_name": string | null,
"earned_stars": number,
"goal_id": string | null,
"goal_raised_at": string | null,
"goal_raised_count": number,
"goal_stars": number | null,
"hints_toggled_by": string | null,
"is_registered_company": boolean | null,
"learning_route": string | null,
"level_by_objective": NonNullable<Json>,
"level_overridden_by_student": NonNullable<Json>,
"level_suggested": number | null,
"own_goal_text": string | null,
"post_test_score": number | null,
"pre_test_score": number | null,
"readiness": NonNullable<Json>,
"scaffold_level": number,
"self_goal_level": number | null,
"student_id": string,
"talent_id": string | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: false
        isSetofReturn: true
      } },
"teacher_set_peer_visible":
{ Args: { "p_submission_id": string,"p_teacher_id": string,"p_visible": boolean }; Returns: {
              "ai_scores": Json | null,
"ai_scores_snapshot": Json | null,
"confirmed_at": string | null,
"confirmed_by": string | null,
"created_at": string,
"domain_name": string,
"emphasis_changed_count": number,
"emphasis_criterion": string | null,
"format": string,
"id": string,
"needs_review": boolean,
"peer_visible": boolean | null,
"pin_hide_name": boolean,
"pinned_at": string | null,
"pinned_by": string | null,
"reason_text": string | null,
"self_scores": Json | null,
"student_id": string,
"teacher_changed": boolean | null,
"teacher_confirmed_scores": Json | null,
"teacher_scores_before": Json | null,
"tld": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "submissions"
        isOneToOne: false
        isSetofReturn: true
      } },
"teacher_set_scaffold":
{ Args: { "p_channel"?: string,"p_level"?: number,"p_note"?: string,"p_reason"?: string,"p_student_id": string,"p_teacher_id": string }; Returns: {
              "audience": string | null,
"boss_template_id": string | null,
"business_edit_unlocked": boolean,
"business_name": string | null,
"business_type": string | null,
"certificate_display_name": string | null,
"channel_chosen_by": string | null,
"channel_suggested": string | null,
"channel_switches": number,
"confidence": NonNullable<Json>,
"domain_name": string | null,
"earned_stars": number,
"goal_id": string | null,
"goal_raised_at": string | null,
"goal_raised_count": number,
"goal_stars": number | null,
"hints_toggled_by": string | null,
"is_registered_company": boolean | null,
"learning_route": string | null,
"level_by_objective": NonNullable<Json>,
"level_overridden_by_student": NonNullable<Json>,
"level_suggested": number | null,
"own_goal_text": string | null,
"post_test_score": number | null,
"pre_test_score": number | null,
"readiness": NonNullable<Json>,
"scaffold_level": number,
"self_goal_level": number | null,
"student_id": string,
"talent_id": string | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: false
        isSetofReturn: true
      } },
"teacher_showcase_likes":
{ Args: { "p_classroom_id": string,"p_teacher_id": string }; Returns: {
              "likes": number,"nickname": string
            }[]
                           },
"teacher_skip_mission":
{ Args: { "p_mission_id": string,"p_note"?: string,"p_reason"?: string,"p_student_id": string,"p_teacher_id": string }; Returns: {
              "id": string,
"mission_id": string,
"reason": string | null,
"skipped_at": string,
"student_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "mission_skips"
        isOneToOne: false
        isSetofReturn: true
      } },
"teacher_unlock_business":
{ Args: { "p_note"?: string,"p_reason"?: string,"p_student_id": string,"p_teacher_id": string,"p_unlocked"?: boolean }; Returns: {
              "audience": string | null,
"boss_template_id": string | null,
"business_edit_unlocked": boolean,
"business_name": string | null,
"business_type": string | null,
"certificate_display_name": string | null,
"channel_chosen_by": string | null,
"channel_suggested": string | null,
"channel_switches": number,
"confidence": NonNullable<Json>,
"domain_name": string | null,
"earned_stars": number,
"goal_id": string | null,
"goal_raised_at": string | null,
"goal_raised_count": number,
"goal_stars": number | null,
"hints_toggled_by": string | null,
"is_registered_company": boolean | null,
"learning_route": string | null,
"level_by_objective": NonNullable<Json>,
"level_overridden_by_student": NonNullable<Json>,
"level_suggested": number | null,
"own_goal_text": string | null,
"post_test_score": number | null,
"pre_test_score": number | null,
"readiness": NonNullable<Json>,
"scaffold_level": number,
"self_goal_level": number | null,
"student_id": string,
"talent_id": string | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: false
        isSetofReturn: true
      } },
"timed_phases":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"touch_student_presence":
{ Args: { "p_screen"?: string,"p_student_id": string }; Returns: {
              "accepts_buddy_requests": boolean,
"buddy_helped_count": number,
"classroom_id": string,
"created_at": string,
"current_screen": string | null,
"device_token": string | null,
"id": string,
"last_seen_at": string | null,
"must_change_pin": boolean,
"nickname": string,
"pin_hash": string,
"pin_reset_at": string | null,
"pin_reset_by": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "students"
        isOneToOne: false
        isSetofReturn: true
      } },
"unlock_student_phase":
{ Args: { "p_note"?: string,"p_phase": string,"p_student_id": string,"p_teacher_id": string }; Returns: {
              "granted_at": string,
"granted_by": string | null,
"id": string,
"note": string | null,
"phase": string,
"revoked_at": string | null,
"student_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "student_phase_unlocks"
        isOneToOne: false
        isSetofReturn: true
      } },
"update_session_settings":
{ Args: { "p_ai_enabled"?: boolean,"p_allow_early_boss"?: boolean,"p_home_deadline"?: string,"p_session_id": string,"p_survey_enabled"?: boolean,"p_teacher_id": string }; Returns: {
              "ai_enabled": boolean,
"allow_early_boss": boolean,
"allow_skip_missions": boolean,
"class_minutes": number,
"classroom_id": string,
"created_at": string,
"ended_at": string | null,
"focus_screen": boolean,
"focus_screen_at": string | null,
"home_deadline": string | null,
"id": string,
"phase": string,
"phase_changed_by": string | null,
"phase_minutes": NonNullable<Json>,
"phase_minutes_custom": boolean,
"phase_started_at": string,
"posttest_closed_at": string | null,
"posttest_enabled": boolean,
"posttest_opened_at": string | null,
"pretest_closed_at": string | null,
"pretest_enabled": boolean,
"pretest_opened_at": string | null,
"previous_phase": string | null,
"previous_phase_at": string | null,
"showcase_enabled": boolean,
"started_at": string,
"survey_enabled": boolean,
"timer_end_at": string | null,
"timer_extended_seconds": number,
"timer_paused_seconds": number | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "class_sessions"
        isOneToOne: false
        isSetofReturn: true
      } },
"verify_teacher_password_reset":
{ Args: { "p_token": string }; Returns: {
              "email": string,"expires_at": string,"teacher_id": string
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const


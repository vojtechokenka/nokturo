-- Enable Realtime for task_comments so new comments appear instantly for other users
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;

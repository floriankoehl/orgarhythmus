import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  Save,
  X,
  CheckCircle2,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Plus,
  Users,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { useAuth } from '../auth/AuthContext';

import {
  fetchSingleTask,
  updateTask,
  fetchTeamsForProject,
  assignTaskMember,
  unassignTaskMember,
  fetch_project_detail,
} from '../api/org_API.js';

export default function ProjectTaskDetail() {
  const { projectId, taskId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [task, setTask] = useState(null);
  const [teams, setTeams] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTeamId, setEditTeamId] = useState(null);
  const [editPriority, setEditPriority] = useState(0);
  const [editDifficulty, setEditDifficulty] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Attempts removed - milestones used instead
  const [expandedAttemptIds, setExpandedAttemptIds] = useState([]);
  
  // Member assignment
  const [assigningMemberId, setAssigningMemberId] = useState(null);
  const [unassigningMemberId, setUnassigningMemberId] = useState(null);

  useEffect(() => {
    loadData();
  }, [projectId, taskId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [taskData, teamsData, projectData] = await Promise.all([
        fetchSingleTask(projectId, taskId),
        fetchTeamsForProject(projectId),
        fetch_project_detail(projectId),
      ]);

      setTask(taskData);
      setTeams(teamsData);
      setProjectMembers(projectData.members_data || []);
      setEditName(taskData.name || '');
      setEditDescription(taskData.description || '');
      setEditTeamId(taskData.team?.id || null);
      setEditPriority(taskData.priority || 0);
      setEditDifficulty(taskData.difficulty || 0);
    } catch (err) {
      console.error(err);
      setError('Failed to load task details.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!editName.trim()) {
      setError('Task name cannot be empty.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const updated = await updateTask(projectId, taskId, {
        name: editName.trim(),
        description: editDescription.trim(),
        team_id: editTeamId,
        priority: editPriority,
        difficulty: editDifficulty,
      });

      setTask(updated);
      setIsEditing(false);
      setSaveSuccess(true);

      // Hide success message after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error(err);
      setError('Failed to update task.');
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditName(task?.name || '');
    setEditDescription(task?.description || '');
    setEditTeamId(task?.team?.id || null);
    setEditPriority(task?.priority || 0);
    setEditDifficulty(task?.difficulty || 0);
    setIsEditing(false);
    setError(null);
  }

  function toggleAttemptExpanded(attemptId) {
    setExpandedAttemptIds((prev) =>
      prev.includes(attemptId) ? prev.filter((id) => id !== attemptId) : [...prev, attemptId],
    );
  }

  // Attempt CRUD removed - milestones used instead

  async function handleAssignMember(userId) {
    setAssigningMemberId(userId);
    try {
      const result = await assignTaskMember(projectId, taskId, userId);
      setTask(result.task);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to assign member');
    } finally {
      setAssigningMemberId(null);
    }
  }

  async function handleUnassignMember(userId) {
    setUnassigningMemberId(userId);
    try {
      const result = await unassignTaskMember(projectId, taskId, userId);
      setTask(result.task);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to unassign member');
    } finally {
      setUnassigningMemberId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-slate-400" />
          <span className="text-sm text-slate-500">Loading task...</span>
        </div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700">{error}</p>
          <Button
            onClick={() => navigate(`/projects/${projectId}/tasks`)}
            style={{ marginTop: '1rem', textTransform: 'none' }}
          >
            Back to Tasks
          </Button>
        </div>
      </div>
    );
  }

  const currentTeam = task?.team;
  const teamColor = currentTeam?.color || '#64748b';
  const attempts = (task?.attempts || [])
    .slice()
    .sort((a, b) => (a.slot_index || 0) - (b.slot_index || 0));

  return (
    <div className="flex min-h-screen w-full justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4">
      <div className="flex w-full max-w-5xl flex-col gap-6 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(`/projects/${projectId}/tasks`)}
          className="group inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-4 py-2 text-slate-900 shadow-sm transition-all duration-200 hover:bg-white/100 hover:shadow-md"
        >
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
          <span className="text-sm font-medium">Back to Tasks</span>
        </button>

        {/* Save Success Message */}
        {saveSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-green-700">
            <CheckCircle2 size={18} />
            <span className="text-sm font-medium">Task updated successfully!</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Header Section */}
        <header className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            {!isEditing ? (
              // VIEW MODE
              <div className="flex-1">
                <h1 className="mb-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
                  {task?.name}
                </h1>

                {currentTeam && (
                  <div
                    onClick={() =>
                      navigate(`/projects/${projectId}/teams/${currentTeam.id}`)
                    }
                    className="flex w-fit cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow-md"
                  >
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: teamColor }} />
                    <span className="text-sm font-medium text-slate-900">{currentTeam.name}</span>
                    <span className="text-xs text-slate-400">→</span>
                  </div>
                )}

                {!currentTeam && (
                  <div className="w-fit rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-sm text-slate-500 italic">No team assigned</span>
                  </div>
                )}
              </div>
            ) : (
              // EDIT MODE
              <div className="flex flex-1 flex-col gap-4">
                <TextField
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  label="Task Name"
                  size="small"
                  fullWidth
                />

                <TextField
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  label="Description"
                  size="small"
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Add a description for this task..."
                />

                <FormControl fullWidth size="small">
                  <InputLabel>Assign Team</InputLabel>
                  <Select
                    value={editTeamId || ''}
                    onChange={(e) => setEditTeamId(e.target.value || null)}
                    label="Assign Team"
                  >
                    <MenuItem value="">
                      <em>No Team</em>
                    </MenuItem>
                    {teams.map((team) => (
                      <MenuItem key={team.id} value={team.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          {team.name}
                        </div>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    type="number"
                    value={editPriority}
                    onChange={(e) => setEditPriority(parseInt(e.target.value) || 0)}
                    label="Priority"
                    size="small"
                    inputProps={{ min: 0, max: 5 }}
                  />
                  <TextField
                    type="number"
                    value={editDifficulty}
                    onChange={(e) => setEditDifficulty(parseInt(e.target.value) || 0)}
                    label="Difficulty"
                    size="small"
                    inputProps={{ min: 0, max: 5 }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-lg bg-blue-50 p-3 text-blue-600 transition-colors hover:bg-blue-100"
                  title="Edit task"
                >
                  <Edit2 size={20} />
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancelEdit}
                    className="rounded-lg bg-slate-100 p-3 text-slate-600 transition-colors hover:bg-slate-200"
                    title="Cancel"
                  >
                    <X size={20} />
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !editName.trim()}
                    className="rounded-lg bg-green-500 p-3 text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Save changes"
                  >
                    {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Task Stats with Circle Indicators */}
          {!isEditing && (
            <div className="mt-4 flex flex-wrap items-center gap-6">
              {/* Priority Circles */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 uppercase">Priority</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-3 w-3 rounded-full ${
                        i <= (task?.priority || 0) ? 'bg-orange-500' : 'bg-slate-300'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Difficulty Circles */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 uppercase">Difficulty</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-3 w-3 rounded-full ${
                        i <= (task?.difficulty || 0) ? 'bg-purple-500' : 'bg-slate-300'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Task ID */}
              <div className="font-mono text-xs text-slate-500">ID: {task?.id}</div>
            </div>
          )}

          {/* Task Description Section */}
          {!isEditing && (
            <div className="mt-6 rounded-lg border border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</span>
              </div>
              {task?.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {task.description}
                </p>
              ) : (
                <p className="italic text-slate-500">No description provided</p>
              )}
            </div>
          )}

          {/* Assigned Members Section */}
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Assigned Members ({task?.assigned_members_data?.length || 0})
                </h3>
              </div>
            </div>

            {/* Currently Assigned Members */}
            {task?.assigned_members_data && task.assigned_members_data.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {task.assigned_members_data.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      {member.username?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-blue-900">{member.username}</span>
                    <button
                      onClick={() => handleUnassignMember(member.id)}
                      disabled={unassigningMemberId === member.id}
                      className="ml-1 rounded p-1 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                      title="Unassign"
                    >
                      {unassigningMemberId === member.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <X size={12} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Available Project Members to Assign */}
            {projectMembers.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold text-slate-600 uppercase">
                  Assign Project Members
                </h4>
                <div className="flex flex-wrap gap-2">
                  {projectMembers
                    .filter(
                      (member) =>
                        !task?.assigned_members_data?.some((am) => am.id === member.id),
                    )
                    .map((member) => (
                      <button
                        key={member.id}
                        onClick={() => handleAssignMember(member.id)}
                        disabled={assigningMemberId === member.id}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
                      >
                        {assigningMemberId === member.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <UserPlus size={14} />
                        )}
                        <span>{member.username}</span>
                        {member.id === user?.id && (
                          <span className="text-slate-500">(you)</span>
                        )}
                      </button>
                    ))}
                </div>
                {projectMembers.every((member) =>
                  task?.assigned_members_data?.some((am) => am.id === member.id),
                ) && (
                  <p className="text-xs italic text-slate-500">All project members assigned</p>
                )}
              </div>
            )}

            {projectMembers.length === 0 && (
              <p className="text-xs italic text-slate-500">No project members available</p>
            )}
          </div>
        </header>

        {/* Milestones info - attempts have been replaced */}
        {task && (
          <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Milestones</h2>
                <p className="mt-1 text-xs text-slate-600">
                  Manage milestones for this task in the Dependencies view.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

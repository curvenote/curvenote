import { describe, expect, beforeEach, it } from 'vitest';
import moment from 'moment';
import type { CommentId } from './comments';
import { commentFromDTO } from './comments';

describe('Comment Blocks', () => {
  let some_comment_id: CommentId;

  beforeEach(() => {
    some_comment_id = {
      project: 'a',
      block: 'b',
      comment: 'text',
    };
  });

  describe('from json', () => {
    it('given empty json, populates with defaults', () => {
      const { id, created_by, content, resolved, edited, date_created, date_modified, links } =
        commentFromDTO(some_comment_id, {});

      expect(id).toEqual(some_comment_id);
      expect(created_by).toBe('');
      expect(content).toBe('');
      expect(resolved).toBe(false);
      expect(edited).toBe(false);
      expect(date_created).instanceOf(Date);
      expect(date_modified).instanceOf(Date);
      expect(links).toEqual({});
    });

    it('given a json object, should be populated with values', () => {
      const jsonComment = {
        created_by: 'user1',
        content: 'hello world!',
        resolved: true,
        edited: true,
        date_created: '2019-10-15T12:09:01.000Z',
        date_modified: '2019-10-25T12:10:01.000Z',
        links: {
          self: 'some/valid/uri',
          block: 'some/valid/block/uri',
        },
      };

      const { id, created_by, content, resolved, edited, date_created, date_modified, links } =
        commentFromDTO(some_comment_id, jsonComment);

      expect(id).toEqual(some_comment_id);
      expect(created_by).toBe(jsonComment.created_by);
      expect(content).toBe(jsonComment.content);
      expect(resolved).toBe(jsonComment.resolved);
      expect(edited).toBe(jsonComment.edited);
      expect(date_created).instanceOf(Date);
      expect(date_created).toEqual(moment.utc('2019-10-15 12:09:01').toDate());
      expect(date_modified).instanceOf(Date);
      expect(date_modified).toEqual(moment.utc('2019-10-25 12:10:01').toDate());
      expect(links['self']).toBeTruthy();
      expect(links['block']).toBeTruthy();
    });
  });

  describe('to json', () => {
    it('given empty object, populates with defaults', () => {
      const minimalComment = {
        id: { ...some_comment_id },
        date_created: moment.utc('2019-10-15 12:09:01').toDate(),
        date_modified: moment.utc('2019-10-25 12:10:01').toDate(),
      };

      const jsonObject = commentFromDTO(some_comment_id, minimalComment);

      expect(jsonObject.id).toEqual(some_comment_id);
      expect(jsonObject.created_by).toBe('');
      expect(jsonObject.content).toBe('');
      expect(jsonObject.resolved).toBe(false);
      expect(jsonObject.edited).toBe(false);
      expect(jsonObject.date_created).instanceOf(Date);
      expect(jsonObject.date_modified).instanceOf(Date);
      expect(jsonObject.links).toEqual({});
    });
  });
});

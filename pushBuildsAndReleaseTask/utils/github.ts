import * as Octokit from '@octokit/rest'

export class Github {
    rest: Octokit.Octokit;
    constructor(public token: string) {
        this.rest = new Octokit.Octokit({
            auth: token,
        })
    }

    public async getLatestCommit(owner: string, repo: string) {
        return this.rest.repos.listCommits({
            owner,
            repo
        }).then(res => {
            return res.data[0];
        }).catch(err => {
            throw new Error(err);
        })
    }
    public async getCommit(owner: string, repo: string, commit: string) {
        return this.rest.git.getCommit({
            owner,
            repo,
            commit_sha: commit
        }).then(res => {
            return res.data;
        }).catch(err => {
            throw new Error(err);
        })
    }

    public async release(owner: string, repo: string, tagName: string, body?: string) {
        return this.rest.repos.createRelease({
            owner,
            repo,
            tag_name: tagName,
            name: tagName,
            body
        })
    }
}
